import React, { useState, useContext } from 'react';
import axios from 'axios';
import { UserContext } from '../context/UserContext';
import Breadcrumb from './Breadcrumb';

const PostStudySurvey = ({ nextProgress }) => {
    const { user, setUser } = useContext(UserContext);
    const [responses, setResponses] = useState({});

    const handleChange = (e) => {
        setResponses(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post('http://localhost:5001/api/surveys/submit', {
                participantId: user.participantId,
                surveyType: 'post-study',
                responses,
                nextProgress
            });
            setUser(response.data.user);
        } catch (error) {
            console.error("Error submitting post-study survey:", error);
        }
    };

    const likertOptions = [
        { value: '1', label: '1 - Not accurate at all' },
        { value: '2', label: '2' },
        { value: '3', label: '3' },
        { value: '4', label: '4' },
        { value: '5', label: '5 - Extremely accurate' }
    ];

    const questions = [
        {
            name: 'confidenceInConcepts',
            label: 'I feel confident in my understanding of the new concepts I learned.'
        },
        {
            name: 'expectBetterPosttest',
            label: 'I believe I will perform significantly better on a posttest, in comparison to the pretest.'
        },
        {
            name: 'satisfiedWithLearningExperience',
            label: 'I am satisfied with the learning experience I had with the chatbot.'
        },
        {
            name: 'feltInControlOfChatbot',
            label: 'I felt in control of the chatbot.'
        },
        {
            name: 'chatbotFeltUncontrollableForce',
            label: 'The chatbot was programmed by a force I couldn\'t control.'
        }
    ];

    return (
        <div className="max-w-2xl mx-auto px-4 py-10 font-sans">
            <Breadcrumb currentStep="post-survey" />

            <h1 className="text-2xl font-bold text-gray-800 mb-1">Post-Survey</h1>
            <p className="text-sm text-gray-500 mb-6">
                On a scale of 1-5, rate how accurate the following statements are.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
                {questions.map((q, idx) => (
                    <div key={q.name} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                            Question {idx + 1}
                        </p>
                        <label htmlFor={q.name} className="block text-base font-semibold text-gray-800 mb-3 leading-snug">
                            {q.label}
                        </label>
                        <select
                            id={q.name}
                            name={q.name}
                            onChange={handleChange}
                            required
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                        >
                            <option value="">Select a rating</option>
                            {likertOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                ))}

                <button
                    type="submit"
                    className="w-full py-3 bg-gray-800 text-white font-semibold rounded-xl hover:bg-gray-700 transition-colors duration-150"
                >
                    Submit Survey
                </button>
            </form>
        </div>
    );
};

export default PostStudySurvey;
