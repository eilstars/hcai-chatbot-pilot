import express from 'express';
import TestResult from '../models/testResult.model.js';
import LearningSession from '../models/learningSession.model.js';
import User from '../models/user.model.js'; 
import { questions } from '../testQuestions.js'; 

const router = express.Router();

// This route handles submitting a test (Updated to handle both full tests and single questions)
router.post('/submit', async (req, res) => {
    const { participantId, testType, answers, nextProgress, questionOrder } = req.body;
    try {
        const ATTENTION_CHECK_ID = 'attention-check-pretest';
        let score = 0;
        const incorrectQuestionTexts = [];

        const isCorrectSubmission = (question, submitted) => {
            const correctAnswerKey = question?.answer;
            if (!correctAnswerKey) return false;
            if (submitted === correctAnswerKey) return true;

            if (question.options && question.options[correctAnswerKey]) {
                const correctText = question.options[correctAnswerKey];
                return typeof submitted === 'string'
                    && submitted.trim().toLowerCase() === String(correctText).trim().toLowerCase();
            }

            return false;
        };
        
        // Find the full question objects from our question bank that were in the test
        const fullQuestions = questions.filter(q => answers.hasOwnProperty(q.id));

        for (const question of fullQuestions) {
            // Find the correct answer key (e.g., 'a', 'b') from the question bank
            const submitted = answers[question.id];
            const isCorrect = isCorrectSubmission(question, submitted);

            if (isCorrect) {
                score++;
            } else {
                incorrectQuestionTexts.push(question.text);
            }
        }
        
        const normalizedQuestionOrder = Array.isArray(questionOrder)
            ? questionOrder.filter((id) => typeof id === 'string')
            : [];

        const isLearningSessionSubmission = String(testType || '').startsWith('learning-session');

        if (isLearningSessionSubmission && fullQuestions.length === 1) {
            const q = fullQuestions[0];
            const submitted = answers[q.id];
            const isCorrect = isCorrectSubmission(q, submitted);

            const existingSession = await LearningSession.findOne({
                participantId,
                sessionType: 'learning-session'
            });

            const existingResponses = existingSession?.responses && typeof existingSession.responses === 'object'
                ? existingSession.responses
                : {};

            const updatedResponses = {
                ...existingResponses,
                [q.id]: {
                    selectedAnswer: String(submitted),
                    correctAnswer: q.answer,
                    isCorrect,
                    questionOrderIndex: normalizedQuestionOrder.indexOf(q.id),
                    submittedAt: new Date().toISOString()
                }
            };

            const learningSessionResult = await LearningSession.findOneAndUpdate(
                { participantId, sessionType: 'learning-session' },
                {
                    $set: {
                        questionOrder: normalizedQuestionOrder,
                        responses: updatedResponses
                    },
                    $inc: { submissionCount: 1 }
                },
                { new: true, upsert: true }
            );

            let user = null;
            if (nextProgress) {
                user = await User.findOneAndUpdate(
                    { participantId },
                    { progress: nextProgress },
                    { new: true }
                );
            } else {
                user = await User.findOne({ participantId });
            }

            return res.status(201).json({
                msg: 'Learning session answer saved successfully',
                user,
                result: learningSessionResult,
                isCorrect,
                correctAnswer: q.answer,
                explanation: q.explanation || ''
            });
        }

        // --- Logic for Single-Question Submissions ---
        // If we are submitting a single question (which we detect by the number of answers), 
        // we append the question ID to the testType to create a unique record.
        let finalTestType = testType;
           if (Object.keys(answers).length === 1 && !isLearningSessionSubmission) {
             const questionId = Object.keys(answers)[0];
             // e.g., if testType is 'post-test-1', finalTestType becomes 'post-test-1-q1'
             finalTestType = `${testType}-${questionId}`;
        }

        const isPretestSubmission = String(testType || '').toLowerCase() === 'pretest';
        const attentionSubmitted = Object.prototype.hasOwnProperty.call(answers || {}, ATTENTION_CHECK_ID);
        const attentionCheckFailed =
            isPretestSubmission && attentionSubmitted
                ? String(answers[ATTENTION_CHECK_ID] || '').toLowerCase() !== 'c'
                : false;

        const newTestResult = new TestResult({
            participantId,
            testType: finalTestType, // Use the unique type
            score,
            answers,
            questionOrder: normalizedQuestionOrder,
            incorrectQuestions: incorrectQuestionTexts,
            attentionCheckFailed
        });
        await newTestResult.save();

        // Only update user progress if nextProgress is provided
        let user = null;
        if (nextProgress) {
            user = await User.findOneAndUpdate(
                { participantId },
                { progress: nextProgress },
                { new: true }
            );
        } else {
            user = await User.findOne({ participantId });
        }
        
        // for single-question submissions return correctness information
        let feedback = {};
        if (fullQuestions.length === 1) {
            const q = fullQuestions[0];
            const qAnswer = q.answer;
            feedback.isCorrect = isCorrectSubmission(q, answers[q.id]);
            feedback.correctAnswer = qAnswer;
            feedback.explanation = q.explanation || '';
        }

        res.status(201).json({
            msg: 'Test submitted successfully',
            user,
            result: newTestResult,
            ...feedback
        });
    } catch (error) {
        console.error('Test submission error:', error);
        res.status(500).json({ msg: 'Server Error' });
    }
});

const shuffleArray = (array) => {
  let shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

router.get('/full-results/:participantId/:testType', async (req, res) => {
    try {
        const { participantId, testType } = req.params;
        const ATTENTION_CHECK_ID = 'attention-check-pretest';

        // Try the exact testType first, then fall back to common legacy variants
        // so participants who completed the pre-test under an older flow name are handled
        const legacyVariants = ['pre-test-1', 'pretest', 'pre-test-2'];
        const typesToTry = [testType, ...legacyVariants.filter(t => t !== testType)];

        let testResult = null;
        for (const t of typesToTry) {
            testResult = await TestResult.findOne({ participantId, testType: t }).sort({ createdAt: -1 });
            if (testResult) break;
        }

        if (!testResult) {
            return res.status(404).json({ msg: 'Test results not found' });
        }

        const orderedQuestionIds = Array.isArray(testResult.questionOrder)
            ? testResult.questionOrder.filter((id) => id !== ATTENTION_CHECK_ID && questions.some((q) => q.id === id))
            : [];

        const orderedQuestions = orderedQuestionIds
            .map((id) => questions.find((q) => q.id === id))
            .filter(Boolean);

        const fullResults = orderedQuestions.map(question => {
            const userAnswerId = testResult.answers[question.id];
            const isCorrect = userAnswerId === question.answer;
            
            const userAnswerText = question.options && question.options.hasOwnProperty(userAnswerId)
                ? question.options[userAnswerId]
                : "No answer";

            return {
                id: question.id,
                text: question.text,
                learningGoal: question.learningGoal,
                isCorrect: isCorrect,
                userAnswerText: userAnswerText,
                options: question.options, // <--- ADD THIS LINE
                explanation: question.explanation || ''
            };
        });

        res.json({ fullResults, questionOrder: orderedQuestions.map((q) => q.id) });
    } catch (error) {
        console.error("Failed to fetch full test results:", error);
        res.status(500).json({ msg: 'Server error' });
    }
});

export default router;