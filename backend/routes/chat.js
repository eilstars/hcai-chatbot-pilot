import express from 'express';
import { OpenAI } from 'openai';
import stringSimilarity from 'string-similarity';
import User from '../models/user.model.js';
import ChatMessage from '../models/chatMessage.model.js';
import ReplayMessage from '../models/replayMessage.model.js';
import TestResult from '../models/testResult.model.js';
import { questions } from '../testQuestions.js';

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const promptTextCache = new Map();

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

function buildPromptCacheKey(participantId, currentQuestionId, message) {
    return `${participantId || ''}|${currentQuestionId || ''}|${(message || '').trim()}`;
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

async function hydratePromptTextOnLatestUserLog({ participantId, currentQuestionId, message, promptText }) {
    if (!participantId || !message || !promptText) return;

    const query = {
        participantId,
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
        model: "gpt-4o",
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
        model: 'gpt-4o',
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
You are evaluating whether a message from a learner is appropriate for a microeconomics tutoring session.

A learner is attempting to learn economics with a tutor. Is this message a reasonable on-topic message from a student?

Current learning question/topic:
"${question.text}"

Student message:
"${message}"

Treat short, casual, and partial messages as valid if they are still clearly related to learning, understanding, clarifying, or responding to the economics concept. Examples of on-topic messages include brief acknowledgements, corrections, and clarifying statements such as:
- "That makes sense"
- "Okay"
- "Awesome"
- "Not really, I believe I understand this particular question. Thank you."
- "I meant, 950000"
- "that was my guess too. glad we are on the same page."
- "ohh"
- "yes, I think so"
- "can you explain why the opportunity cost is 35?"

Do not classify a message as off-topic merely because it is short, conversational, or incomplete.
Only classify as NO if it is clearly unrelated to the learning task, such as irrelevant topics, requests for non-educational content, or obviously off-task behavior.

Respond with ONLY "YES" or "NO".
`;

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
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

// --- Main Chat Route ---
router.post('/message', async (req, res) => {
    const { participantId, message, round, bypassIntervention, chatHistory, currentQuestionId, replayMode, replayRound, sourceRow } = req.body;
    try {
        const promptTrace = [];
        const trackPrompt = ({ stage, model, messages, max_tokens = null }) => {
            promptTrace.push({ stage, model, messages, max_tokens });
        };

        let user = null;
        {
            user = await User.findOne({ participantId });
            if (!user) return res.status(404).json({ msg: 'User not found' });
        }

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
                wasIntervention: false,
                threeStepLogic: 'none',
                interventionType: 'none',
                promptText: responsePromptText,
                isStandalone: true,
                questionStandalone: true,
                wasRewritten: false,
                rewrittenMessage: null,
                effectiveMessage: message
            });
        }

        // --- 1. Pre-processing and intervention checks ---
        const originalMessage = (message || '').trim();
        let effectiveMessage = originalMessage;
        let rewrittenMessage = null;
        let isStandalone = true;
        let wasRewritten = false;
        const currentQuestionObj = questions.find(q => q.id === String(currentQuestionId));

        if (!replayMode) {
            const likelyContextDependent = isLikelyContextDependent(originalMessage);
            trackPrompt({
                stage: 'deterministicContextGate',
                model: 'rule-based',
                messages: [{ role: 'system', content: `likelyContextDependent=${likelyContextDependent}; message="${originalMessage}"` }]
            });
            promptTrace[promptTrace.length - 1].output = likelyContextDependent ? 'CONTEXT_DEPENDENT_CANDIDATE' : 'LIKELY_STANDALONE';

            const standalonePrompt = `
        Decide whether the "User Message" itself contains enough information to stand alone without relying on earlier chat history.

        Important rule: A message is NOT standalone if it is vague, elliptical, or depends on prior context, pronouns, or earlier discussion.
        Examples of messages that should be "NO": "elaborate", "why?", "what about it", "that makes no sense", "can you answer it", "yes", "okay", "explain more", "what does that mean?"
        Examples of messages that should be "YES": "Can you explain opportunity cost in this question?", "What is the difference between scarcity and shortage?", "Please clarify the concept of marginal utility."

        Evaluate the message by itself, not whether the tutor could answer it using the current question context.
        Respond with only the single word "YES" if the message is self-contained and can stand alone, or "NO" if it depends on earlier chat history or is too vague to be understood without context.

        Chat History:
        ${(chatHistory || []).map(m => `${(m.role || m.sender) === 'user' ? 'User' : 'Assistant'}: ${m.content || m.text}`).join('\n')}

        User Message: "${originalMessage}"
    `;
            const standaloneMessages = [{ role: 'system', content: standalonePrompt }];
        trackPrompt({ stage: 'judgeIfInputIsStandalone', model: 'gpt-4o', messages: standaloneMessages, max_tokens: 2 });
        const standaloneCompletion = await openai.chat.completions.create({
            model: 'gpt-4o',
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
        The user has sent a follow-up message that doesn't make sense on its own.
        Please rewrite the user's "New Message" into a complete, standalone question by adding context from the "Chat History".
        
        Chat History:
        ${historyString}

        New Message: "${message}"

        Rewritten Standalone Question:
    `;
            const rewriteMessages = [{ role: 'system', content: rewritePrompt }];
            trackPrompt({ stage: 'addContextToInput', model: 'gpt-4o', messages: rewriteMessages, max_tokens: 150 });
            const rewriteCompletion = await openai.chat.completions.create({
                model: 'gpt-4o',
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

        let systemMessage = "You are a helpful microeconomics tutor. Use the chat history for context.";
        let botReplyText = "";
        let threeStepLogic = "none";
        let questionRevealsAnswer = null;

        // --- 2. Relevancy, verbatim, and answer-seeking checks ---
        if (currentQuestionObj) {
            const interventionMessage = effectiveMessage || originalMessage;
            const relatedness = await isMessageRelatedToTopic(interventionMessage, currentQuestionObj);
            trackPrompt({
                stage: 'relevancyCheck',
                model: 'gpt-4o',
                messages: [{
                    role: 'system',
                    content: `questionId=${currentQuestionObj.id}; message="${interventionMessage}"`
                }],
                max_tokens: 5
            });
            promptTrace[promptTrace.length - 1].output = relatedness.isOnTopic ? 'ON_TOPIC' : 'OUTLANDISH';

            if (!relatedness.isOnTopic) {
                threeStepLogic = 'outlandish';
            } else {
                const verbatimSimilarity = stringSimilarity.compareTwoStrings(
                    interventionMessage.toLowerCase(),
                    currentQuestionObj.text.toLowerCase()
                );
                trackPrompt({
                    stage: 'verbatimCheck',
                    model: 'rule-based',
                    messages: [{ role: 'system', content: `similarity=${verbatimSimilarity.toFixed(4)}` }]
                });
                promptTrace[promptTrace.length - 1].output = verbatimSimilarity > 0.95 ? 'VERBATIM' : 'NOT_VERBATIM';

                if (verbatimSimilarity > 0.95) {
                    threeStepLogic = 'verbatim';
                } else {
                    questionRevealsAnswer = await evaluateIfQuestionRevealsAnswer(
                        interventionMessage,
                        currentQuestionObj.text,
                        currentQuestionObj.answer,
                        currentQuestionObj.options
                    );
                    trackPrompt({
                        stage: 'questionRevealsAnswer',
                        model: 'gpt-4o',
                        messages: [{ role: 'system', content: `questionId=${currentQuestionObj.id}` }],
                        max_tokens: 5
                    });
                    promptTrace[promptTrace.length - 1].output = questionRevealsAnswer === true ? 'YES' : 'NO';
                    if (questionRevealsAnswer === true) {
                        threeStepLogic = 'semantic';
                    }
                }
            }
        }

        // --- 3. Handle Final Response ---

        if (!replayMode && round === 1 && (threeStepLogic === 'verbatim' || threeStepLogic === 'semantic')) {
            await User.updateOne({ _id: user._id }, { $inc: { interventions_round1: 1 } });
        } else if (!replayMode && round === 2 && (threeStepLogic === 'verbatim' || threeStepLogic === 'semantic')) {
            await User.updateOne({ _id: user._id }, { $inc: { suboptimal_questions_round2: 1 } });
        }

        if (!botReplyText) {
            const formattedHistory = (chatHistory || [])
                .filter(msg => msg.role !== 'system' && msg.sender !== 'system')
                .map(msg => ({
                    role: (msg.role || msg.sender) === 'user' ? 'user' : 'assistant',
                    content: msg.content || msg.text || ''
                }));

            const questionContextBlock = currentQuestionObj
                ? {
                    role: 'system',
                    content: `Current question: ${currentQuestionObj.text}\n\nOptions:\n${Object.entries(currentQuestionObj.options || {}).map(([key, value]) => `${key}. ${value}`).join('\n')}`
                }
                : null;

            const tutorMessages = [
                { role: 'system', content: systemMessage },
                ...(questionContextBlock ? [questionContextBlock] : []),
                ...formattedHistory,
                { role: 'user', content: effectiveMessage || originalMessage }
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
        if (replayMode) {
            if (!replayRound) return res.status(400).json({ msg: 'replayRound is required in replay mode' });
            await ReplayMessage.create({
                replayRound: String(replayRound),
                participantId,
                round: Number(round),
                currentQuestionId: String(currentQuestionId),
                message: originalMessage,
                response: botReplyText,
                threeStepLogic,
                promptText: responsePromptText,
                effectiveMessage,
                sourceRow: Number(sourceRow) || null
            });
        }
        const cacheKey = buildPromptCacheKey(participantId, round, currentQuestionId, message);
        setPromptTextCache(cacheKey, responsePromptText);
        if (!replayMode) {
            await hydratePromptTextOnLatestUserLog({
                participantId,
                round,
                currentQuestionId,
                message,
                promptText: responsePromptText
            });
        }

        res.json({
            message: botReplyText,
            sender: 'bot',
            wasIntervention: (threeStepLogic !== 'none'),
            threeStepLogic,
            interventionType: threeStepLogic, // backwards compatibility
            promptText: responsePromptText,
            isStandalone,
            questionStandalone: isStandalone,
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
            model: 'gpt-4o',
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
            threeStepLogic: incomingThreeStepLogic,
            promptText,
            promptTrace,
            isStandalone,
            questionStandalone,
            wasRewritten,
            rewrittenMessage,
            effectiveMessage
        } = req.body;

        console.log(`[LOG-MESSAGE] Received: sender=${sender}, qId=${currentQuestionId}, msg_len=${message?.length}`);

        let effectiveThreeStepLogic = ['outlandish', 'verbatim', 'semantic', 'none'].includes(incomingThreeStepLogic)
            ? incomingThreeStepLogic
            : 'none';

        if (sender === 'user' && !['outlandish', 'verbatim', 'semantic'].includes(incomingThreeStepLogic) && currentQuestionId && questionContext) {
            console.log(`[EVAL] Evaluating message for Q${currentQuestionId}:`, message.substring(0, 50));
            // Find the question in the question bank to get the correct answer
            const question = questions.find(q => q.id === String(currentQuestionId));
            if (question && question.answer && question.options) {
                console.log(`[EVAL] Found question, correct answer: ${question.answer}`);
                const questionRevealsAnswer = await evaluateIfQuestionRevealsAnswer(
                    message,
                    questionContext,
                    question.answer,
                    question.options
                );
                effectiveThreeStepLogic = questionRevealsAnswer === true ? 'semantic' : 'none';
                console.log(`[EVAL] Result: ${questionRevealsAnswer}; threeStepLogic=${effectiveThreeStepLogic}`);
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

        const isStandaloneVal = typeof isStandalone === 'boolean'
            ? isStandalone
            : (typeof questionStandalone === 'boolean' ? questionStandalone : true);

        const cacheKey = buildPromptCacheKey(participantId, round, currentQuestionId, message);
        const cachedPromptText = getPromptTextCache(cacheKey);
        const basePromptText = normalizedPromptText || cachedPromptText;
        const decisionAuditBlock = [
            '---',
            '',
            'Stage: decisionAudit | model=rule-based',
            `isStandalone: ${isStandaloneVal ? 'YES' : 'NO'}`,
            `wasRewritten: ${wasRewritten ? 'YES' : 'NO'}`,
            `threeStepLogic: ${effectiveThreeStepLogic}`
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
            wasIntervention: effectiveThreeStepLogic !== 'none',
            threeStepLogic: effectiveThreeStepLogic,
            interventionType: effectiveThreeStepLogic,
            isStandalone: isStandaloneVal,
            questionStandalone: isStandaloneVal,
            wasRewritten: typeof wasRewritten === 'boolean' ? wasRewritten : false,
            rewrittenMessage: rewrittenMessage || null,
            effectiveMessage: effectiveMessage || message
        });

        if (sender === 'user' && finalPromptText && cachedPromptText) {
            promptTextCache.delete(cacheKey);
        }

        console.log(`[LOG-MESSAGE] Saving message with threeStepLogic=${effectiveThreeStepLogic}, isStandalone=${isStandaloneVal}`);
        const savedMessage = await newMessage.save();
        console.log(`[LOG-MESSAGE] Saved successfully:`, savedMessage._id);

        res.status(201).json({
            msg: 'Message logged successfully.',
            threeStepLogic: effectiveThreeStepLogic,
            isStandalone: isStandaloneVal,
            questionStandalone: isStandaloneVal,
            messageId: savedMessage._id
        });
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