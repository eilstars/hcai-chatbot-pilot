import express from 'express';
import { OpenAI } from 'openai';
import stringSimilarity from 'string-similarity';
import User from '../models/user.model.js';
import ChatMessage from '../models/chatMessage.model.js';
import TestResult from '../models/testResult.model.js';
import { questions } from '../testQuestions.js';
import { semanticBank } from '../semanticBank.js';
import { pipeline } from '@xenova/transformers';

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const promptTextCache = new Map();

// --- Semantic Search Setup ---
let extractorPromise;
async function initializeSemanticSearch() {
    if (!extractorPromise) {
        // Use pipeline() which is the recommended way
        extractorPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    return extractorPromise;
}

// Function to calculate cosine similarity
function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    // Add epsilon for numerical stability
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
}

// Initialize the model when the server starts
initializeSemanticSearch().then(() => console.log("Semantic search model loaded and ready."));

function formatPromptTraceAsText(promptTrace) {
    if (!Array.isArray(promptTrace) || promptTrace.length === 0) {
        return '';
    }

    return promptTrace
        .map((entry, index) => {
            const header = `Stage ${index + 1}: ${entry.stage || 'unknown'} | model=${entry.model || 'unknown'}`;
            const maxTokens = entry.max_tokens ? `\nmax_tokens: ${entry.max_tokens}` : '';
            const messagesText = Array.isArray(entry.messages)
                ? entry.messages.map((msg, msgIndex) => `[${msgIndex + 1}] ${msg.role || 'unknown'}: ${msg.content || ''}`).join('\n')
                : '';
            const outputText = typeof entry.output === 'string' && entry.output.trim().length > 0
                ? `\n\nModel output:\n${entry.output}`
                : '';

            return `${header}${maxTokens}\n${messagesText}${outputText}`.trim();
        })
        .join('\n\n---\n\n');
}

function buildPromptCacheKey(participantId, round, currentQuestionId, message) {
    return `${participantId || ''}|${round || ''}|${currentQuestionId || ''}|${(message || '').trim()}`;
}

function setPromptTextCache(key, promptText) {
    if (!key || !promptText) return;
    promptTextCache.set(key, { promptText, createdAt: Date.now() });

    // Keep cache bounded and short-lived.
    if (promptTextCache.size > 1000) {
        const cutoff = Date.now() - (15 * 60 * 1000);
        for (const [cacheKey, value] of promptTextCache.entries()) {
            if (!value || value.createdAt < cutoff) {
                promptTextCache.delete(cacheKey);
            }
        }
    }
}

function getPromptTextCache(key) {
    const entry = promptTextCache.get(key);
    if (!entry) return '';

    // Expire entries older than 15 minutes.
    if (Date.now() - entry.createdAt > 15 * 60 * 1000) {
        promptTextCache.delete(key);
        return '';
    }

    return entry.promptText || '';
}

async function hydratePromptTextOnLatestUserLog({ participantId, round, currentQuestionId, message, promptText }) {
    if (!participantId || !round || !message || !promptText) return;

    const query = {
        participantId,
        round,
        sender: 'user',
        message,
        promptText: { $in: [null, ''] }
    };

    if (currentQuestionId !== undefined && currentQuestionId !== null) {
        query.currentQuestionId = String(currentQuestionId);
    }

    await ChatMessage.findOneAndUpdate(
        query,
        { $set: { promptText } },
        { sort: { createdAt: -1 } }
    );
}

// --- Pre-processing Functions ---

// 1. Judge if input is standalone
async function judgeIfInputIsStandalone(message, chatHistory) {
    if (chatHistory.length === 0) return true; // No history, so it must be standalone
    
    const prompt = `
        Analyze the "User Message" in the context of the "Chat History".
        Does the "User Message" make complete sense on its own, or is it a short follow-up (like "yes", "why?", "can you answer it") that depends on the previous turn?
        Respond with only the single word "YES" if it's standalone, or "NO" if it needs context.

        Chat History:
        ${chatHistory.map(m => `${(m.role || m.sender) === 'user' ? 'User' : 'Assistant'}: ${m.content || m.text}`).join('\n')}

        User Message: "${message}"
    `;
    
    const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ "role": "system", "content": prompt }],
        max_tokens: 2
    });
    return completion.choices[0].message.content.includes('YES');
}

// 2. Add context to the input
async function addContextToInput(message, chatHistory) {
    const historyString = chatHistory
        .map(m => `${(m.role || m.sender) === 'user' ? 'User' : 'Assistant'}: ${m.content || m.text}`)
        .join('\n');

    const prompt = `
        The user has sent a short follow-up message that doesn't make sense on its own.
        Please rewrite the user's "New Message" into a complete, standalone question by adding context from the "Chat History".
        
        Chat History:
        ${historyString}

        New Message: "${message}"

        Rewritten Standalone Question:
    `;
    
    const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ "role": "system", "content": prompt }],
        max_tokens: 150
    });
    return completion.choices[0].message.content.trim();
}

function isLikelyContextDependent(message) {
    const normalized = (message || '').trim().toLowerCase();
    if (!normalized) return false;

    const explicitFollowUps = new Set([
        'yes', 'no', 'maybe', 'ok', 'okay', 'sure',
        'why', 'why?', 'how so', 'what do you mean',
        'it', 'that', 'this', 'those', 'these',
        'can you answer it', 'can you explain it'
    ]);

    if (explicitFollowUps.has(normalized)) return true;
    if (/^(and|also|then|so)\b/.test(normalized)) return true;
    if (/^what about (that|it|this)\b/.test(normalized)) return true;
    if (/^how about (that|it|this)\b/.test(normalized)) return true;

    // Very short pronoun-heavy messages are usually context-dependent follow-ups.
    const words = normalized.split(/\s+/).filter(Boolean);
    const pronounCount = words.filter(w => ['it', 'that', 'this', 'they', 'them', 'he', 'she'].includes(w)).length;
    return words.length <= 4 && pronounCount >= 1;
}

function isRewriteIntentPreserved(originalMessage, rewrittenMessage) {
    const original = (originalMessage || '').trim().toLowerCase();
    const rewritten = (rewrittenMessage || '').trim().toLowerCase();
    if (!original || !rewritten) return false;

    const similarity = stringSimilarity.compareTwoStrings(original, rewritten);
    if (similarity >= 0.45) return true;

    // If original is a direct question with concrete terms, require stronger overlap.
    const originalTokens = new Set(original.split(/[^a-z0-9]+/).filter(t => t.length >= 3));
    if (originalTokens.size === 0) return false;
    let overlap = 0;
    for (const token of originalTokens) {
        if (rewritten.includes(token)) overlap += 1;
    }
    return (overlap / originalTokens.size) >= 0.5;
}

async function isMessageRelatedToTopic(message, question) {
    if (!message || !question?.text) {
        return { isOnTopic: true, reason: 'insufficient-input' };
    }

    const prompt = `
You are classifying whether a student message is related to the learning topic.

Current learning question/topic:
"${question.text}"

Student message:
"${message}"

Is the student message related to this topic/question, even if loosely or partially?
Respond with ONLY "YES" or "NO".
`;

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'system', content: prompt }],
            max_tokens: 5
        });

        const result = (completion.choices[0]?.message?.content || '').trim().toUpperCase();
        return {
            isOnTopic: result.includes('YES'),
            reason: `model-result:${result || 'EMPTY'}`
        };
    } catch (error) {
        console.error('Topic relatedness check failed:', error);
        // Fail open to avoid incorrectly blocking valid learning questions.
        return { isOnTopic: true, reason: 'model-error' };
    }
}

function getQuestionSemanticBestMatch(messageVector, question) {
    if (!question || !Array.isArray(messageVector) || messageVector.length === 0) {
        return { score: 0, source: null };
    }

    let bestScore = 0;
    let bestSource = null;

    if (Array.isArray(question.semanticEmbeddings)) {
        for (let i = 0; i < question.semanticEmbeddings.length; i++) {
            const variationEmbedding = question.semanticEmbeddings[i];
            if (!Array.isArray(variationEmbedding) || variationEmbedding.length !== messageVector.length) continue;
            const score = cosineSimilarity(messageVector, variationEmbedding);
            if (score > bestScore) {
                bestScore = score;
                bestSource = `semanticEmbedding:${i}`;
            }
        }
    }

    if (Array.isArray(question.embedding) && question.embedding.length === messageVector.length) {
        const mainScore = cosineSimilarity(messageVector, question.embedding);
        if (mainScore > bestScore) {
            bestScore = mainScore;
            bestSource = 'mainEmbedding';
        }
    }

    return { score: bestScore, source: bestSource };
}

function getBestSemanticBankEntryForQuestion(messageVector, questionId, questionObj) {
    const fallback = { entry: null, index: -1, score: -1 };
    if (!Array.isArray(messageVector) || messageVector.length === 0 || !questionObj || !questionId) return fallback;

    const bankEntries = Array.isArray(semanticBank[questionId]) ? semanticBank[questionId] : [];
    if (bankEntries.length === 0) return fallback;

    let bestEntry = null;
    let bestScore = -1;
    let bestIndex = -1;

    for (let i = 0; i < bankEntries.length; i++) {
        const variationEmbedding = Array.isArray(questionObj.semanticEmbeddings)
            ? questionObj.semanticEmbeddings[i]
            : null;
        if (!Array.isArray(variationEmbedding) || variationEmbedding.length !== messageVector.length) continue;

        const score = cosineSimilarity(messageVector, variationEmbedding);
        if (score > bestScore) {
            bestScore = score;
            bestEntry = bankEntries[i];
            bestIndex = i;
        }
    }

    return { entry: bestEntry, index: bestIndex, score: bestScore };
}

// --- Main Chat Route ---
router.post('/message', async (req, res) => {
    const { participantId, message, round, bypassIntervention, chatHistory, currentQuestionId } = req.body;
    try {
        const promptTrace = [];
        const trackPrompt = ({ stage, model, messages, max_tokens = null }) => {
            promptTrace.push({ stage, model, messages, max_tokens });
        };

        let user = await User.findOne({ participantId });
        if (!user) return res.status(404).json({ msg: 'User not found' });

        // --- Optional bypass path (kept for compatibility) ---
        if (bypassIntervention) {
            const bypassSystemMessage = "You are a helpful microeconomics tutor. Please answer the user's question directly.";
            const bypassMessages = [{ role: 'system', content: bypassSystemMessage }, { role: 'user', content: message }];
            trackPrompt({ stage: 'bypassIntervention', model: 'gpt-4', messages: bypassMessages });
            const response = await openai.chat.completions.create({
                model: "gpt-4",
                messages: bypassMessages,
            });
            const botReplyText = response.choices[0].message.content;
            promptTrace[promptTrace.length - 1].output = botReplyText;
            const responsePromptText = formatPromptTraceAsText(promptTrace);
            const cacheKey = buildPromptCacheKey(participantId, round, currentQuestionId, message);
            setPromptTextCache(cacheKey, responsePromptText);
            await hydratePromptTextOnLatestUserLog({
                participantId,
                round,
                currentQuestionId,
                message,
                promptText: responsePromptText
            });

            return res.json({
                message: botReplyText,
                sender: 'bot',
                wasIntervention: true,
                interventionType: 'semantic',
                promptText: responsePromptText
            });
        }

        // --- 1. Pre-processing Step ---
        const originalMessage = (message || '').trim();
        const likelyContextDependent = isLikelyContextDependent(originalMessage);
        let effectiveMessage = originalMessage;
        let rewrittenMessage = null;
        let isStandalone = true;
        let wasRewritten = false;

        trackPrompt({
            stage: 'deterministicContextGate',
            model: 'rule-based',
            messages: [{ role: 'system', content: `likelyContextDependent=${likelyContextDependent}; message="${originalMessage}"` }]
        });
        promptTrace[promptTrace.length - 1].output = likelyContextDependent ? 'CONTEXT_DEPENDENT_CANDIDATE' : 'LIKELY_STANDALONE';

        if (likelyContextDependent) {
            const standalonePrompt = `
        Analyze the "User Message" in the context of the "Chat History".
        Does the "User Message" make complete sense on its own, or is it a short follow-up (like "yes", "why?", "can you answer it") that depends on the previous turn?
        Respond with only the single word "YES" if it's standalone, or "NO" if it needs context.

        Chat History:
        ${(chatHistory || []).map(m => `${(m.role || m.sender) === 'user' ? 'User' : 'Assistant'}: ${m.content || m.text}`).join('\n')}

        User Message: "${originalMessage}"
    `;
            const standaloneMessages = [{ role: 'system', content: standalonePrompt }];
            trackPrompt({ stage: 'judgeIfInputIsStandalone', model: 'gpt-3.5-turbo', messages: standaloneMessages, max_tokens: 2 });
            const standaloneCompletion = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: standaloneMessages,
                max_tokens: 2
            });
            promptTrace[promptTrace.length - 1].output = standaloneCompletion.choices[0].message.content;
            isStandalone = standaloneCompletion.choices[0].message.content.includes('YES');

            if (!isStandalone) {
                const historyString = (chatHistory || [])
                    .map(m => `${(m.role || m.sender) === 'user' ? 'User' : 'Assistant'}: ${m.content || m.text}`)
                    .join('\n');

                const rewritePrompt = `
        The user has sent a short follow-up message that doesn't make sense on its own.
        Please rewrite the user's "New Message" into a complete, standalone question by adding context from the "Chat History".
        
        Chat History:
        ${historyString}

        New Message: "${message}"

        Rewritten Standalone Question:
    `;
                const rewriteMessages = [{ role: 'system', content: rewritePrompt }];
                trackPrompt({ stage: 'addContextToInput', model: 'gpt-3.5-turbo', messages: rewriteMessages, max_tokens: 150 });
                const rewriteCompletion = await openai.chat.completions.create({
                    model: 'gpt-3.5-turbo',
                    messages: rewriteMessages,
                    max_tokens: 150
                });
                promptTrace[promptTrace.length - 1].output = rewriteCompletion.choices[0].message.content;
                const rawRewritten = rewriteCompletion.choices[0].message.content.trim();

                const rewritePreservedIntent = isRewriteIntentPreserved(originalMessage, rawRewritten);
                trackPrompt({
                    stage: 'rewriteIntentValidation',
                    model: 'rule-based',
                    messages: [{ role: 'system', content: `original="${originalMessage}"\nrewritten="${rawRewritten}"` }]
                });
                promptTrace[promptTrace.length - 1].output = rewritePreservedIntent ? 'PASSED' : 'FAILED';

                if (rewritePreservedIntent) {
                    rewrittenMessage = rawRewritten;
                    wasRewritten = true;
                    effectiveMessage = rawRewritten;
                    console.log(`Context added. Original: "${originalMessage}", Effective: "${effectiveMessage}"`);
                } else {
                    effectiveMessage = originalMessage;
                    console.log(`Rewrite discarded due to intent drift. Original kept: "${originalMessage}"`);
                }
            }
        }

        // --- 2. Intervention Checks (always use original user intent) ---
        let systemMessage = "You are a helpful microeconomics tutor. Use the chat history for context.";
        let botReplyText = "";
        let interventionType = "none";
        let interventionScore = null;
        let semanticMatchedBankEntry = null;
        const interventionMessage = originalMessage;
        
        // Find the specific question the user is working on
        const currentQuestionObj = questions.find(q => q.id === currentQuestionId);

        if (currentQuestionObj) {
            // Check 1: Verbatim (Targeted)
            // Compare against the full text of the CURRENT question (which includes options)
            const similarity = stringSimilarity.compareTwoStrings(interventionMessage.toLowerCase(), currentQuestionObj.text.toLowerCase());
            
            if (similarity > 0.95) { // High threshold for full text match
                interventionType = "verbatim";
                interventionScore = similarity;
                // No behavior intervention: all users receive the standard tutor response.
            } else {
                // Check 2: Semantic (Targeted)
                const extractor = await initializeSemanticSearch();
                const messageEmbedding = await extractor(interventionMessage, { pooling: 'mean', normalize: true });
                const messageVector = Array.from(messageEmbedding.data);

                const targetedMatch = getQuestionSemanticBestMatch(messageVector, currentQuestionObj);
                const highestScore = targetedMatch.score;
                const bestBankMatch = getBestSemanticBankEntryForQuestion(messageVector, currentQuestionObj.id, currentQuestionObj);
                const bestBankEntry = bestBankMatch.entry;
                const bestBankEntryScore = bestBankMatch.score;
                const bestBankEntryIndex = bestBankMatch.index;

                if (typeof bestBankEntry === 'string' && bestBankEntry.trim().length > 0) {
                    semanticMatchedBankEntry = bestBankEntry;
                }

                trackPrompt({
                    stage: 'semanticBestQuestionMatch',
                    model: 'rule-based',
                    messages: [{
                        role: 'system',
                        content: `targetedQuestion=${currentQuestionObj.id}; targetedScore=${highestScore.toFixed(4)}; bestBankEntryIndex=${bestBankEntryIndex}; bestBankEntryScore=${bestBankEntryScore.toFixed(4)}`
                    }]
                });
                promptTrace[promptTrace.length - 1].output = `bestBankEntryIndex=${bestBankEntryIndex}; bestBankEntryScore=${bestBankEntryScore.toFixed(4)}`;

                if (highestScore > 0.75) {
                    interventionType = "semantic";
                    interventionScore = highestScore;
                } else {
                    // Check 3: Off-Topic (LLM topic-relatedness)
                    const topicCheck = await isMessageRelatedToTopic(interventionMessage, currentQuestionObj);
                    trackPrompt({
                        stage: 'topicRelatednessCheck',
                        model: 'gpt-3.5-turbo',
                        messages: [{
                            role: 'system',
                            content: `questionId=${currentQuestionObj.id}; reason=${topicCheck.reason}`
                        }]
                    });
                    promptTrace[promptTrace.length - 1].output = topicCheck.isOnTopic ? 'RELATED' : 'NOT_RELATED';

                    if (!topicCheck.isOnTopic) {
                        interventionType = "outlandish";
                    }
                }
            }

            // Evaluate if question directly seeks answer choice
            if (currentQuestionObj.answer && currentQuestionObj.options) {
                const questionReveals = await evaluateIfQuestionRevealsAnswer(
                    interventionMessage,
                    currentQuestionObj.text,
                    currentQuestionObj.answer,
                    currentQuestionObj.options
                );
                if (questionReveals === true && interventionType !== 'verbatim') {
                    interventionType = 'semantic';
                }
            }
        }

        // --- 3. Handle Final Response ---
        
        if (round === 1 && (interventionType === 'verbatim' || interventionType === 'semantic')) {
            await User.updateOne({ _id: user._id }, { $inc: { interventions_round1: 1 } });
        } else if (round === 2 && (interventionType === 'verbatim' || interventionType === 'semantic')) {
            await User.updateOne({ _id: user._id }, { $inc: { suboptimal_questions_round2: 1 } });
        }

        if (!botReplyText) {
            const formattedHistory = (chatHistory || [])
                .filter(msg => msg.role !== 'system' && msg.sender !== 'system')
                .map(msg => ({
                    role: (msg.role || msg.sender) === 'user' ? 'user' : 'assistant',
                    content: msg.content || msg.text || ''
                }));
            const tutorMessages = [
                { role: 'system', content: systemMessage },
                ...formattedHistory,
                { role: 'user', content: effectiveMessage }
            ];
            trackPrompt({ stage: 'finalTutorResponse', model: 'gpt-4', messages: tutorMessages });
            const response = await openai.chat.completions.create({
                model: "gpt-4",
                messages: tutorMessages,
            });
            botReplyText = response.choices[0].message.content;
            promptTrace[promptTrace.length - 1].output = botReplyText;
        }

        const responsePromptText = formatPromptTraceAsText(promptTrace);
        const cacheKey = buildPromptCacheKey(participantId, round, currentQuestionId, message);
        setPromptTextCache(cacheKey, responsePromptText);
        await hydratePromptTextOnLatestUserLog({
            participantId,
            round,
            currentQuestionId,
            message,
            promptText: responsePromptText
        });

        res.json({
            message: botReplyText,
            sender: 'bot',
            wasIntervention: (interventionType !== 'none'),
            interventionType,
            interventionScore,
            semanticMatchedBankEntry,
            promptText: responsePromptText,
            isStandalone,
            wasRewritten,
            rewrittenMessage,
            effectiveMessage
        });

    } catch (error) {
        console.error('Chat error:', error);
        const isQuotaError = error?.code === 'credit_balance_exhausted' || error?.status === 429;
        const errorMsg = isQuotaError
            ? 'OpenAI API quota exceeded (credit balance exhausted). Please update your API key or billing in backend/.env.'
            : (error?.message || 'Server Error');
        res.status(500).json({ msg: errorMsg, code: error?.code });
    }
});

// --- Evaluation Function: Check if a question reveals the answer ---
async function evaluateIfQuestionRevealsAnswer(studentQuestion, multipleChoiceQuestionContext, correctAnswerKey, options) {
    if (!studentQuestion || !multipleChoiceQuestionContext) return null;
    
    // Build the options text for the prompt
    let optionsText = "";
    if (options && typeof options === 'object') {
        optionsText = Object.entries(options)
            .map(([key, value]) => `${key}. ${value}`)
            .join('\n');
    }
    
    const prompt = `
You are an expert educational evaluator determining if a student's message is a direct answer-seeking attempt.

Multiple Choice Question Context:
${multipleChoiceQuestionContext}

Options:
${optionsText}

Correct Answer Choice: Option ${correctAnswerKey}

Student Question: "${studentQuestion}"

Determine if the student's question is directly asking for the correct answer choice (e.g., asking "is it A?", "which option is correct?", "give me the answer"), or asking to confirm/select the right option.

CRITICAL RULE: General conceptual questions asking to explain concepts or definitions (e.g., "what is scarcity?", "how does opportunity cost work?", "can you explain diminished utility?") are NOT answer-seeking attempts.

Respond with ONLY "YES" if the student's question is directly seeking or attempting to extract the correct option letter/choice. Otherwise, respond with ONLY "NO".`;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 5
        });
        const result = completion.choices[0].message.content.trim().toUpperCase();
        return result.includes('YES');
    } catch (error) {
        console.error("Error evaluating if question reveals answer:", error);
        return null;
    }
}

// --- Route: Log a Chat Message ---
router.post('/log-message', async (req, res) => {
    try {
        const {
            participantId,
            round,
            sender,
            message,
            currentQuestionId,
            questionContext,
            interventionType,
            interventionScore,
            semanticMatchedBankEntry,
            promptText,
            promptTrace,
            isStandalone,
            wasRewritten,
            rewrittenMessage,
            effectiveMessage
        } = req.body;
        
        console.log(`[LOG-MESSAGE] Received: sender=${sender}, qId=${currentQuestionId}, msg_len=${message?.length}`);
        
        let questionRevealsAnswer = null;
        
        // Only evaluate if this is a user message with question context
        if (sender === 'user' && currentQuestionId && questionContext) {
            console.log(`[EVAL] Evaluating message for Q${currentQuestionId}:`, message.substring(0, 50));
            // Find the question in the question bank to get the correct answer
            const question = questions.find(q => q.id === String(currentQuestionId));
            if (question && question.answer && question.options) {
                console.log(`[EVAL] Found question, correct answer: ${question.answer}`);
                questionRevealsAnswer = await evaluateIfQuestionRevealsAnswer(
                    message,
                    questionContext,
                    question.answer,
                    question.options
                );
                console.log(`[EVAL] Result: ${questionRevealsAnswer}`);
            } else {
                console.log(`[EVAL] Question not found or missing answer/options`);
            }
        } else {
            console.log(`[EVAL] Skipping evaluation: sender=${sender}, qId=${currentQuestionId}, hasContext=${!!questionContext}`);
        }
        
        const normalizedPromptText =
            (typeof promptText === 'string' && promptText.trim().length > 0)
                ? promptText
                : formatPromptTraceAsText(promptTrace);

        // Retain verbatim if originally verbatim. Do NOT overwrite verbatim with semantic.
        let effectiveInterventionType = 'none';
        if (sender === 'user') {
            if (interventionType === 'verbatim') {
                effectiveInterventionType = 'verbatim';
            } else if (questionRevealsAnswer === true) {
                effectiveInterventionType = 'semantic';
            } else {
                effectiveInterventionType = interventionType || 'none';
            }
        }

        // Preserve actual numerical similarity score. Never default to hardcoded 1.
        let effectiveInterventionScore = null;
        if (sender === 'user') {
            if (typeof interventionScore === 'number' && !isNaN(interventionScore)) {
                effectiveInterventionScore = interventionScore;
            }
        }

        const effectiveSemanticMatchedBankEntry =
            (sender === 'user' && typeof semanticMatchedBankEntry === 'string' && semanticMatchedBankEntry.trim().length > 0)
                ? semanticMatchedBankEntry.trim()
                : null;

        let resolvedSemanticMatchedBankEntry = effectiveSemanticMatchedBankEntry;
        if (!resolvedSemanticMatchedBankEntry && sender === 'user' && currentQuestionId && message && effectiveInterventionType === 'semantic') {
            try {
                const currentQuestionObj = questions.find((q) => q.id === String(currentQuestionId));
                if (currentQuestionObj) {
                    const extractor = await initializeSemanticSearch();
                    const messageEmbedding = await extractor(message, { pooling: 'mean', normalize: true });
                    const messageVector = Array.from(messageEmbedding.data);
                    const bestBankMatch = getBestSemanticBankEntryForQuestion(messageVector, String(currentQuestionId), currentQuestionObj);
                    if (typeof bestBankMatch.entry === 'string' && bestBankMatch.entry.trim().length > 0) {
                        resolvedSemanticMatchedBankEntry = bestBankMatch.entry.trim();
                    }
                }
            } catch (fallbackError) {
                console.error('[LOG-MESSAGE] Semantic bank fallback failed:', fallbackError);
            }
        }

        const cacheKey = buildPromptCacheKey(participantId, round, currentQuestionId, message);
        const cachedPromptText = getPromptTextCache(cacheKey);
        const basePromptText = normalizedPromptText || cachedPromptText;
        const revealsAnswerOutput =
            questionRevealsAnswer === null
                ? 'SKIPPED'
                : (questionRevealsAnswer ? 'YES' : 'NO');
        const outlandishOutput = effectiveInterventionType === 'outlandish' ? 'YES' : 'NO';
        const semanticBankEntryOutput = resolvedSemanticMatchedBankEntry || 'NONE';
        const decisionAuditBlock = [
            '---',
            '',
            'Stage: decisionAudit | model=rule-based',
            `questionRevealsAnswer: ${revealsAnswerOutput}`,
            `outlandish: ${outlandishOutput}`,
            `semanticMatchedBankEntry: ${semanticBankEntryOutput}`
        ].join('\n');
        const finalPromptText = basePromptText
            ? `${basePromptText}\n\n${decisionAuditBlock}`
            : decisionAuditBlock;

        const newMessage = new ChatMessage({
            participantId,
            round,
            sender,
            message,
            promptText: finalPromptText,
            currentQuestionId: currentQuestionId ? String(currentQuestionId) : undefined,
            wasIntervention: effectiveInterventionType !== 'none',
            interventionType: effectiveInterventionType,
            interventionScore: effectiveInterventionScore,
            semanticMatchedBankEntry: resolvedSemanticMatchedBankEntry,
            questionRevealsAnswer,
            isStandalone: typeof isStandalone === 'boolean' ? isStandalone : true,
            wasRewritten: typeof wasRewritten === 'boolean' ? wasRewritten : false,
            rewrittenMessage: rewrittenMessage || null,
            effectiveMessage: effectiveMessage || message
        });

        if (sender === 'user' && finalPromptText && cachedPromptText) {
            promptTextCache.delete(cacheKey);
        }
        
        console.log(`[LOG-MESSAGE] Saving message with interventionType=${effectiveInterventionType}, interventionScore=${effectiveInterventionScore}`);
        const savedMessage = await newMessage.save();
        console.log(`[LOG-MESSAGE] Saved successfully:`, savedMessage._id);
        
        res.status(201).json({ msg: 'Message logged successfully.', questionRevealsAnswer, messageId: savedMessage._id });
    } catch (error) {
        console.error("Error logging message:", error);
        res.status(500).json({ msg: 'Server Error', error: error.message });
    }
});

// --- Route: Fetch isolated Chat History per question ---
router.get('/history/:participantId/:round/:currentQuestionId', async (req, res) => {
    try {
        const { participantId, round, currentQuestionId } = req.params;
        const messages = await ChatMessage.find({
            participantId,
            round: Number(round),
            currentQuestionId: String(currentQuestionId)
        }).sort({ createdAt: 1 });

        res.json({ messages });
    } catch (error) {
        console.error("Error fetching chat history per question:", error);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// --- Nudge Button Handler ---
router.post('/nudge-action', async (req, res) => {
    try {
        const { participantId, round, currentQuestionId, action } = req.body;
        // action is 'ask-anyway' or 'ask-else'
        
        console.log(`[NUDGE] Action '${action}' for Q${currentQuestionId} by participant ${participantId}`);
        
        let response = '';
        if (action === 'ask-anyway') {
            response = 'Okay! Go ahead and ask your question. I\'ll do my best to help you understand the concept.';
        } else if (action === 'ask-else') {
            response = 'Good thinking! Let\'s explore another angle. What aspect of the topic would you like to understand better?';
        }
        
        res.status(200).json({ msg: 'Nudge action recorded', response });
    } catch (error) {
        console.error('Error handling nudge action:', error);
        res.status(500).json({ msg: 'Server Error' });
    }
});

export default router;