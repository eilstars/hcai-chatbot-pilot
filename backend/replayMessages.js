import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_BASE_URL = 'http://localhost:5000/api/chat';
const DEFAULT_OUTPUT = './replay-results.jsonl';

function printUsage() {
    console.log(`Usage:
  node backend/replayMessages.js --input ./pilot-messages.csv
  node backend/replayMessages.js --input ./pilot-messages.json --execute

Options:
  --input <path>       CSV or JSON export of the pilot messages.
  --output <path>      JSONL output path (default: ${DEFAULT_OUTPUT}).
  --base-url <url>     Chat API base URL (default: ${DEFAULT_BASE_URL}).
  --execute            Actually call the improved platform. Without this flag, validate only.
`);
}

function parseArgs(argv) {
    const options = { input: '', output: DEFAULT_OUTPUT, baseUrl: DEFAULT_BASE_URL, execute: false };
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--execute') options.execute = true;
        else if (arg === '--input') options.input = argv[++index] || '';
        else if (arg === '--output') options.output = argv[++index] || DEFAULT_OUTPUT;
        else if (arg === '--base-url') options.baseUrl = argv[++index] || DEFAULT_BASE_URL;
        else if (arg === '--help' || arg === '-h') {
            printUsage();
            process.exit(0);
        } else {
            throw new Error(`Unknown argument: ${arg}`);
        }
    }
    if (!options.input) throw new Error('Missing required --input path.');
    return options;
}

function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;

    for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        const next = text[index + 1];
        if (character === '"' && quoted && next === '"') {
            cell += '"';
            index += 1;
        } else if (character === '"') {
            quoted = !quoted;
        } else if (character === ',' && !quoted) {
            row.push(cell);
            cell = '';
        } else if ((character === '\n' || character === '\r') && !quoted) {
            if (character === '\r' && next === '\n') index += 1;
            row.push(cell);
            if (row.some(value => value.trim() !== '')) rows.push(row);
            row = [];
            cell = '';
        } else {
            cell += character;
        }
    }
    if (cell || row.length > 0) {
        row.push(cell);
        if (row.some(value => value.trim() !== '')) rows.push(row);
    }

    if (rows.length < 2) return [];
    const headers = rows[0].map(header => header.replace(/^\uFEFF/, '').trim());
    return rows.slice(1).map(values => Object.fromEntries(
        headers.map((header, index) => [header, (values[index] || '').trim()])
    ));
}

async function readRows(inputPath) {
    const text = await fs.readFile(inputPath, 'utf8');
    if (path.extname(inputPath).toLowerCase() === '.json') {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) throw new Error('JSON input must contain an array of message rows.');
        return parsed;
    }
    return parseCsv(text);
}

function getValue(row, names, fallback = '') {
    for (const name of names) {
        if (row[name] !== undefined && row[name] !== null && String(row[name]).trim() !== '') {
            return String(row[name]).trim();
        }
    }
    return fallback;
}

function normalizeRows(rows) {
    return rows.map((row, index) => {
        const sender = getValue(row, ['sender', 'role', 'author', 'type'], 'user').toLowerCase();
        return {
            sourceRow: index + 2,
            participantId: getValue(row, ['participantId', 'participant_id', 'participant', 'userId']),
            round: getValue(row, ['round', 'studyRound'], '1'),
            currentQuestionId: getValue(row, ['currentQuestionId', 'questionId', 'question_id', 'question']),
            sender: sender === 'assistant' ? 'bot' : sender,
            message: getValue(row, ['message', 'content', 'text']),
            timestamp: getValue(row, ['timestamp', 'createdAt', 'created_at', 'date']),
            sequence: getValue(row, ['sequence', 'index', 'order'], String(index))
        };
    });
}

function sortRows(rows) {
    return [...rows].sort((left, right) => {
        const groupCompare = `${left.participantId}|${left.round}|${left.currentQuestionId}`
            .localeCompare(`${right.participantId}|${right.round}|${right.currentQuestionId}`);
        if (groupCompare !== 0) return groupCompare;

        const leftSeq = Number(left.sequence) || Number(left.sourceRow) || 0;
        const rightSeq = Number(right.sequence) || Number(right.sourceRow) || 0;
        return leftSeq - rightSeq;
    });
}

function validateRows(rows) {
    const errors = [];
    rows.forEach((row, index) => {
        if (!row.participantId) errors.push(`row ${row.sourceRow || index + 2}: missing participantId`);
        if (!row.currentQuestionId) errors.push(`row ${row.sourceRow || index + 2}: missing currentQuestionId`);
        if (!row.message) errors.push(`row ${row.sourceRow || index + 2}: missing message`);
        if (!['user', 'bot', 'system'].includes(row.sender)) errors.push(`row ${row.sourceRow || index + 2}: invalid sender "${row.sender}"`);
    });
    return errors;
}

function toHistory(rows) {
    return rows.map(row => ({
        role: row.sender === 'user' ? 'user' : (row.sender === 'bot' ? 'assistant' : 'system'),
        content: row.message
    }));
}

async function replay(options, rows) {
    const sortedRows = sortRows(rows);
    const histories = new Map();
    const results = [];

    for (const row of sortedRows) {
        const key = `${row.participantId}|${row.round}|${row.currentQuestionId}`;
        const history = histories.get(key) || [];

        if (row.sender === 'user') {
            const response = await fetch(`${options.baseUrl.replace(/\/$/, '')}/message`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    participantId: row.participantId,
                    message: row.message,
                    round: Number(row.round),
                    currentQuestionId: row.currentQuestionId,
                    chatHistory: history,
                    replayMode: true
                })
            });
            const body = await response.json();
            if (!response.ok) throw new Error(`API failed for source row ${row.sourceRow}: ${response.status} ${JSON.stringify(body)}`);

            results.push({
                sourceRow: row.sourceRow,
                participantId: row.participantId,
                round: row.round,
                currentQuestionId: row.currentQuestionId,
                originalMessage: row.message,
                ...body
            });
            history.push({ role: 'user', content: row.message }, { role: 'assistant', content: body.message });
        } else if (row.sender === 'system') {
            history.push(...toHistory([row]));
        }
        histories.set(key, history);
    }
    return results;
}

const main = async () => {
    try {
        const options = parseArgs(process.argv.slice(2));
        const rows = normalizeRows(await readRows(options.input));
        const errors = validateRows(rows);
        if (errors.length > 0) throw new Error(`Input validation failed:\n${errors.join('\n')}`);

        const userRows = rows.filter(row => row.sender === 'user');
        console.log(`Validated ${rows.length} rows (${userRows.length} user messages).`);
        if (!options.execute) {
            console.log('Dry run only. No API calls were made and no output file was written.');
            return;
        }

        const results = await replay(options, rows);
        await fs.mkdir(path.dirname(path.resolve(options.output)), { recursive: true });
        await fs.writeFile(options.output, results.map(result => JSON.stringify(result)).join('\n') + '\n', 'utf8');
        console.log(`Replayed ${results.length} user messages. Results written to ${options.output}`);
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
};

main();