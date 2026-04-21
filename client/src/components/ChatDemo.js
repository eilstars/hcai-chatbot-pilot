import React from 'react';
import Chatbot from './Chatbot';

// A simple component to display the question
const QuestionDisplay = ({ question }) => {
    // We split the question text into lines to render it nicely
    const questionLines = question.text.split('\n');

    return (
        <div className="bg-gray-100 p-6 rounded-lg shadow-md h-full">
            <h3 className="text-lg font-bold mb-4 text-gray-800">Your Target Question:</h3>
            <div className="text-left bg-white p-4 rounded-lg">
                {questionLines.map((line, index) => (
                    <p key={index} className="text-gray-700 mb-2">{line}</p>
                ))}
            </div>
            <div className="mt-4 p-4 bg-blue-100 border-l-4 border-blue-500 rounded-lg text-blue-800">
                <p className="font-semibold">Your Goal:</p>
                <p>Use the chatbot to understand the core concepts behind this question. You can ask about the topic, rephrase the question, or even paste it directly to see how the bot responds!</p>
            </div>
        </div>
    );
};


const ChatDemo = ({ question, nextProgress }) => {
    if (!question) {
        return <div>Loading question...</div>;
    }

    return (
        <div className="w-full max-w-7xl mx-auto p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Column: The Question */}
                <div className="w-full">
                    <QuestionDisplay question={question} />
                </div>

                {/* Right Column: The Chatbot */}
                <div className="w-full">
                    {/* We pass the single incorrect question text in an array, as the backend expects */}
                    <Chatbot 
                        round={1} 
                        nextProgress={nextProgress} 
                        incorrectQuestions={[question.text]} 
                    />
                </div>
            </div>
        </div>
    );
};

export default ChatDemo;
