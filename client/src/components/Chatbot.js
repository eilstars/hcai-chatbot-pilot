import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import Breadcrumb from './Breadcrumb';

const formatPromptTraceAsText = (promptTrace) => {
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

            return `${header}${maxTokens}\n${messagesText}`.trim();
        })
        .join('\n\n---\n\n');
};

/**
 * Main Chatbot Learning Session Component
 */
const Chatbot = ({ participantId, round, onComplete, preTestResults = [], testTypeToSubmit }) => {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [sessionAnswers, setSessionAnswers] = useState({});
    const [submittedStatus, setSubmittedStatus] = useState({});
    // feedback for each question after submission
    const [feedback, setFeedback] = useState({});
    const [timeLeft, setTimeLeft] = useState(1200); // 20 Minutes
    const [chatHistories, setChatHistories] = useState({});
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [nudgedMessage, setNudgedMessage] = useState(null); // Store message that triggered nudge
    const [learningQuestions, setLearningQuestions] = useState([]);
    const chatEndRef = useRef(null);

    useEffect(() => {
        if (preTestResults.length > 0) {
            setLearningQuestions(preTestResults);
        }
    }, [preTestResults]);

    const currentQuestion = learningQuestions[currentQuestionIndex] || {};
    const currentQId = currentQuestion.id || currentQuestionIndex;

    // Auto-scroll the chat window when new messages arrive or question changes
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistories, currentQuestionIndex]);

    // Session Timer logic
    useEffect(() => {
        if (timeLeft <= 0) {
            onComplete();
            return;
        }
        const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        return () => clearInterval(timer);
    }, [timeLeft, onComplete]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Get current conversation or start a new one for this specific question
    const currentMessages = chatHistories[currentQId] || [
        { role: 'system', content: `I am an AI tutor to help you with microeconomics. Ask me anything about this question to prepare for your post-test.` }
    ];

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMsg = input.trim();
        const updatedHistory = [...currentMessages, { role: 'user', content: userMsg }];
        
        setInput('');
        setChatHistories(prev => ({ ...prev, [currentQId]: updatedHistory }));
        setLoading(true);

        try {
            const response = await axios.post('/api/chat/message', {
                participantId,
                message: userMsg,
                round,
                currentQuestionId: currentQId,
                questionContext: currentQuestion.text,
                learningGoal: currentQuestion.learningGoal,
                chatHistory: currentMessages
            });

            // Extract the reply from your backend response structure
            const botReplyText = response.data.message || response.data.reply;
            const interventionType = response.data.interventionType || 'none';
            const interventionScore = response.data.interventionScore || null;
            const semanticMatchedBankEntry = response.data.semanticMatchedBankEntry || null;
            const promptText =
                typeof response.data.promptText === 'string' && response.data.promptText.trim().length > 0
                    ? response.data.promptText
                    : formatPromptTraceAsText(response.data.promptTrace);
            const botReply = { role: 'bot', content: botReplyText };

            // Log the user message after prompt generation so we can persist exact prompts used.
            try {
                await axios.post('/api/chat/log-message', {
                    participantId,
                    round,
                    sender: 'user',
                    message: userMsg,
                    currentQuestionId: currentQId,
                    questionContext: currentQuestion.text,
                    interventionType,
                    interventionScore,
                    semanticMatchedBankEntry,
                    promptText
                });
            } catch (e) {
                console.error("User message log error:", e);
            }
            
            // Check if this is a nudge message - if so, store original message
            if (botReplyText.includes('[Ask anyway]') || botReplyText.includes('[Ask something else]')) {
                setNudgedMessage(userMsg);
            }
            
            setChatHistories(prev => ({
                ...prev,
                [currentQId]: [...(prev[currentQId] || updatedHistory), botReply]
            }));
            
            // Log the bot response with intervention info
            try {
                await axios.post('/api/chat/log-message', {
                    participantId,
                    round,
                    sender: 'bot',
                    message: botReplyText,
                    currentQuestionId: currentQId,
                    promptText
                });
            } catch (e) {
                console.error("Bot message log error:", e);
            }
        } catch (error) {
            console.error("Chat Error:", error);
            setChatHistories(prev => ({
                ...prev,
                [currentQId]: [...(prev[currentQId] || updatedHistory), { role: 'bot', content: "Error connecting to tutor. Please try again." }]
            }));
        } finally {
            setLoading(false);
        }
    };

    const handleResubmit = async () => {
        // This function now handles an actual submission to the tests endpoint
        const selectedKey = sessionAnswers[currentQId];
        if (!selectedKey) return;

        // send answer to tests submit endpoint
        try {
            const payload = {
                participantId,
                testType: testTypeToSubmit || 'learning-session',
                answers: { [currentQuestion.id]: selectedKey },
                round,
                questionOrder: learningQuestions.map((q) => q.id)
            };
            const resp = await axios.post('/api/tests/submit', payload);
            const { isCorrect, explanation, correctAnswer } = resp.data;
            setFeedback(prev => ({ ...prev, [currentQId]: { isCorrect, explanation, correctAnswer } }));
        } catch (err) {
            console.error("Error submitting learning answer:", err);
        }

        // lock submission permanently after first submit
        setSubmittedStatus(prev => ({ ...prev, [currentQId]: true }));
    };

    const handleNudgeAction = async (action) => {
        if (action === 'ask-anyway' && nudgedMessage) {
            // Resend the original message through chat with bypass flag
            setNudgedMessage(null);
            
            const userMsg = nudgedMessage;

            setLoading(true);
            try {
                const response = await axios.post('/api/chat/message', {
                    participantId,
                    message: userMsg,
                    round,
                    currentQuestionId: currentQId,
                    questionContext: currentQuestion.text,
                    learningGoal: currentQuestion.learningGoal,
                    chatHistory: currentMessages,
                    bypassIntervention: true
                });

                const botReplyText = response.data.message || response.data.reply;
                const promptText =
                    typeof response.data.promptText === 'string' && response.data.promptText.trim().length > 0
                        ? response.data.promptText
                        : formatPromptTraceAsText(response.data.promptTrace);
                const botReply = { role: 'bot', content: botReplyText };
                
                setChatHistories(prev => ({
                    ...prev,
                    [currentQId]: [...(prev[currentQId] || currentMessages), botReply]
                }));
                
                // Log bot response
                try {
                    await axios.post('/api/chat/log-message', {
                        participantId,
                        round,
                        sender: 'bot',
                        message: botReplyText,
                        currentQuestionId: currentQId,
                        promptText
                    });
                } catch (e) {
                    console.error("Bot message log error:", e);
                }
            } catch (error) {
                console.error("Chat Error:", error);
                setChatHistories(prev => ({
                    ...prev,
                    [currentQId]: [...(prev[currentQId] || currentMessages), { role: 'bot', content: "Error connecting to tutor. Please try again." }]
                }));
            } finally {
                setLoading(false);
            }
        } else if (action === 'ask-else') {
            setNudgedMessage(null);
            const responseMessage = { role: 'bot', content: 'Sure! What aspect of this topic would you like to explore?' };
            setChatHistories(prev => ({
                ...prev,
                [currentQId]: [...(prev[currentQId] || currentMessages), responseMessage]
            }));
        }
    };

    // keep option keys along with text so we can track answer IDs
    const optionsArray = currentQuestion.options
        ? Object.entries(currentQuestion.options) // [ [key,text], ... ]
        : [];

    if (!learningQuestions || learningQuestions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-20 bg-gray-50 min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <div className="font-bold text-gray-400 uppercase tracking-widest text-sm">Loading Learning Session...</div>
            </div>
        );
    }

    return (
        <div className="max-w-[1600px] mx-auto px-5 pt-2 pb-2 flex flex-col h-screen overflow-hidden bg-gray-50 font-sans">
            {/* Header Section */}
            <div className="flex flex-row justify-between items-center">
                <Breadcrumb currentStep="learning-1" />
                <div className={`px-4 py-1 rounded-full border font-bold text-base bg-white shadow-sm ${timeLeft < 60 ? 'text-red-600 border-red-200 animate-pulse' : 'text-gray-700 border-gray-200'}`}>
                    {formatTime(timeLeft)}
                </div>
            </div>

            <h1 className="text-lg font-black text-center text-gray-700 mb-3 tracking-tight">
                Question {currentQuestionIndex + 1} of {learningQuestions.length}
            </h1>

            {/* Split Screen Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0 items-stretch">
                
                {/* LEFT COLUMN: Question & History */}
                <div className="flex flex-col min-h-0">
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 flex-1 flex flex-col overflow-y-auto">
                        {/* <div className="bg-blue-50 text-blue-700 text-[12px] font-black px-3 py-1 rounded-full w-fit mb-4 border border-blue-100">
                            Goal: {currentQuestion.learningGoal}
                        </div> */}
                        
                        <h2 className="text-[16px] font-bold text-gray-800 mb-3 leading-tight">
                            {currentQuestion.text}
                        </h2>

                    {/* PRE-TEST FEEDBACK LOGIC */}
                        <div className={`mt-2 mb-3 p-3 rounded-2xl border-l-8 shadow-sm bg-blue-100 border-blue-500`}>
                            <div className="bg-white/70 rounded-xl">
                                <p className="text-[14px] pt-1 font-bold text-blue-500 ">This question is designed to help you understand the following:</p>
                                <div className="flex items-center justify-between">
                                    <p className="text-[14px] italic text-gray-800 mx-auto">
                                        <span className="">{currentQuestion.learningGoal || 'Not Answered'}</span>
                                    </p> 
                                </div>
                                <p className="text-[14px] pt-1 font-bold text-blue-500  mb-2">Use the AI tutor to achieve this learning goal.</p>
                                </div>
                            <div className="mt-2 p-3 text-gray-700 text-sm leading-relaxed">
                                <b className="text-blue-500">Your previous answer:</b> <br /> {currentQuestion.userAnswerText}
                            </div>
                        </div>

                        {/* Interactive Options Area */}
                        <div className="space-y-2">
                            {optionsArray.map(([optKey, optText]) => (
                                <label 
                                    key={optKey} 
                                    className={`flex text-left items-center p-3 border-2 rounded-2xl transition-all duration-200 ${
                                        submittedStatus[currentQId] ? 'cursor-default' : 'cursor-pointer'
                                    } ${
                                        sessionAnswers[currentQId] === optKey 
                                            ? 'border-blue-500 bg-blue-50 shadow-sm' 
                                            : 'border-gray-50 hover:border-blue-200 hover:bg-gray-50'
                                    }`}
                                >
                                    <input 
                                        type="radio" 
                                        name={`session-q-${currentQId}`} 
                                        checked={sessionAnswers[currentQId] === optKey} 
                                        onChange={() => {
                                            if (submittedStatus[currentQId]) return;
                                            setSessionAnswers({...sessionAnswers, [currentQId]: optKey});
                                        }} 
                                        disabled={!!submittedStatus[currentQId]}
                                        className="w-5 h-5 text-blue-600 focus:ring-blue-500" 
                                    />
                                    <span className="ml-4 text-gray-700 font-small leading-relaxed">{optText}</span>
                                </label>
                            ))}
                        </div>

                        {/* Blind Submission + feedback */}
                        <div className="mt-3 flex flex-col space-y-2">
                            <div className="flex items-center space-x-4">
                                <button 
                                    onClick={handleResubmit} 
                                    disabled={!sessionAnswers[currentQId] || !!submittedStatus[currentQId]}
                                    className="px-10 py-3.5 bg-gray-900 hover:bg-black text-white font-black rounded-xl transition-all transform active:scale-95 disabled:bg-gray-200 uppercase text-xs tracking-widest"
                                >
                                    {submittedStatus[currentQId] ? 'Submitted' : 'Submit Answer'}
                                </button>
                                {submittedStatus[currentQId] && (
                                    <span className="text-green-600 font-bold flex items-center animate-fade-in">                                        
                                    </span>
                                )}
                            </div>
                            {feedback[currentQId] && (
                                <div className={`p-4 rounded-lg ${feedback[currentQId].isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    <strong>{feedback[currentQId].isCorrect ? 'Correct!' : 'Incorrect.'}</strong>
                                    <div className="mt-1 text-sm">
                                        {feedback[currentQId].explanation && (
                                            <span>{feedback[currentQId].explanation}</span>
                                        )}
                                        {!feedback[currentQId].explanation && feedback[currentQId].correctAnswer && (
                                            <span>Correct answer: {currentQuestion.options[feedback[currentQId].correctAnswer]}</span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        
                    </div>
                </div>

                {/* RIGHT COLUMN: Question-Specific Chatbot */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col overflow-hidden min-h-0">
                    <div className="bg-blue-200 px-4 py-2 border-b border-blue-100 text-center font-black text-blue-700 uppercase text-[11px] tracking-widest flex-shrink-0">
                        Question {currentQuestionIndex + 1}
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
                        {currentMessages.map((m, i) => (
                            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] p-5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                                    m.role === 'user' 
                                        ? 'bg-blue-600 text-right text-white font-medium rounded-tr-none' 
                                        : 'bg-gray-100 text-left text-gray-800 border border-gray-200 rounded-tl-none'
                                }`}>
                                    <ReactMarkdown
                                        components={{
                                            a: ({ node, ...props }) => {
                                                if (props.href === '/ask-anyway') {
                                                    return (
                                                        <button
                                                            onClick={() => handleNudgeAction('ask-anyway')}
                                                            className="text-blue-600 hover:text-blue-800 underline font-semibold cursor-pointer inline"
                                                        >
                                                            {props.children}
                                                        </button>
                                                    );
                                                } else if (props.href === '/ask-else') {
                                                    return (
                                                        <button
                                                            onClick={() => handleNudgeAction('ask-else')}
                                                            className="text-blue-600 hover:text-blue-800 underline font-semibold cursor-pointer inline"
                                                        >
                                                            {props.children}
                                                        </button>
                                                    );
                                                }
                                                return <a {...props} />;
                                            }
                                        }}
                                    >
                                        {m.content}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-gray-50 text-gray-400 p-4 rounded-xl text-xs italic animate-pulse border border-gray-100">
                                    Typing...
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    <div className="p-3 border-t border-gray-100 bg-white shadow-inner flex-shrink-0">
                        <div className="flex flex-col space-y-2">
                            <textarea 
                                className="w-full p-3 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-700 focus:border-transparent outline-none resize-none transition-all text-sm h-16 leading-relaxed"
                                placeholder="Ask your tutor to explain the logic behind this concept..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                            />
                            <button 
                                onClick={handleSend}
                                disabled={loading || !input.trim()}
                                className="self-end px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-full transition-all active:scale-95 disabled:bg-gray-200  text-xs tracking-widest "
                            >
                                Ask
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Pagination Controls */}
            <div className="mt-2 mb-2 flex justify-between items-center max-w-0xl mx-auto w-full">
                <button 
                    onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentQuestionIndex === 0}
                    className="px-5 py-2 bg-white border border-gray-200 rounded-2xl font-black text-gray-500 hover:bg-gray-50 disabled:opacity-10 transition-all flex items-center shadow-sm  text-xs"
                >
                    <span className="mr-2 text-xl">←</span> Previous
                </button>

                <div className="flex flex-col items-end">
                    {!submittedStatus[currentQId] && (
                        <p className="text-xs text-gray-400 mb-1">Submit your answer to continue</p>
                    )}
                    <button 
                        onClick={() => {
                            if (currentQuestionIndex < learningQuestions.length - 1) {
                                setCurrentQuestionIndex(prev => prev + 1);
                            } else {
                                onComplete();
                            }
                        }}
                        disabled={!submittedStatus[currentQId]}
                        className="px-5 py-2 bg-white border border-gray-900 rounded-2xl font-black text-gray-900 hover:bg-gray-900 hover:text-white transition-all shadow-sm flex items-center text-xs disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-gray-900"
                    >
                        {currentQuestionIndex === learningQuestions.length - 1 ? 'Finish Learning Review' : 'Next Topic'}
                        <span className="ml-2 text-xl">→</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Chatbot;
