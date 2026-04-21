import React, { useContext } from 'react';
import { UserContext } from '../context/UserContext';
import axios from 'axios';
import Breadcrumb from './Breadcrumb';

const ChatbotIntro = ({ nextProgress }) => {
    const { user, setUser } = useContext(UserContext);

    const handleContinue = async () => {
        try {
            // Update user progress to the first question (q1)
            const response = await axios.post('/api/users/update-progress', {
                participantId: user.participantId,
                progress: nextProgress // Should be "chat-1-q1"
            });
            setUser(response.data);
        } catch (error) {
            console.error("Error updating progress:", error);
            alert("Could not start session. Please try again.");
        }
    };

    return (
        <div>
            <Breadcrumb currentStep="learning-1" />
            <h1 className="text-2xl font-bold text-gray-800 mb-1">Prepare for the learning session</h1>
            <div className="space-y-4 text-gray-700">
                <p className="px-10 text-sm text-gray-500 mb-6"> You will now engage with an artificial intelligence (AI) tutor chatbot and revisit the questions you 
                    just answered. Please take advantage of the chatbot as a learning tool to learn about the concepts 
                    behind the questions and revise your answers from the pretest if needed. You have 20 minutes to review 
                    all 9 questions. 
                    <br/><br/>
                    The AI tutor chatbot can occasionally produce inaccurate, incomplete, or biased outputs, 
                    which may pose a risk if relied upon without human judgment. Although the research team has reviewed the 
                    chatbot’s performance on answering microeconomics-related questions and found it satisfactory, there 
                    remains a possibility that errors could occur or that the system may not fully account for individual 
                    circumstances. You should not consider chatbot-generated responses as a substitute for professional 
                    guidance, and you may ask questions or leverage external resources at any time if something is unclear.
                </p>
            </div>
            <button
                onClick={handleContinue}
                className="mt-8  py-3 px-4 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition duration-150"
            >
                Start Learning Session
            </button>
        </div>
    );
};

export default ChatbotIntro;
