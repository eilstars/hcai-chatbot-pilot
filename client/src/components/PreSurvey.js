import React, { useState, useContext } from 'react';
import axios from 'axios';
import { UserContext } from '../context/UserContext';
import Breadcrumb from './Breadcrumb';

const PreSurvey = ({ nextProgress }) => {
  const { user, setUser } = useContext(UserContext);
  const [responses, setResponses] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setResponses(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:5001/api/surveys/submit', {
        participantId: user.participantId,
        surveyType: 'initial-ai',
        responses: responses,
        nextProgress
      });
      setUser(response.data.user);
    } catch (error) {
      console.error("Error submitting survey:", error);
    }
  };

  const questions = [
    {
      name: 'usageFrequency',
      label: 'How many times a month do you use an AI chatbot?',
      options: [
        { value: 'daily', label: 'At least every day' },
        { value: 'weekly', label: 'At least once a week' },
        { value: 'monthly', label: 'A few times a month' },
        { value: 'never', label: 'Never' },
      ],
    },
    {
      name: 'messageFrequency',
      label: 'How many messages do you send an AI chatbot, per session?',
      options: [
        { value: '0', label: '0' },
        { value: '1-3', label: '1–3' },
        { value: '4-10', label: '4–10' },
        { value: '10+', label: '10+' },
      ],
    },
    {
      name: 'AIReliability',
      label: 'In general, you find AI chatbots to be:',
      options: [
        { value: 'alwaysUnreliable', label: 'Almost always unreliable' },
        { value: 'oftenUnreliable', label: 'Often unreliable' },
        { value: 'sometimesReliable', label: 'Sometimes reliable' },
        { value: 'oftenReliable', label: 'Often reliable' },
        { value: 'neverReliable', label: 'Almost always reliable' },
      ],
    },
    {
      name: 'usageInSchool',
      label: 'How often do you use AI chatbots when working on school assignments?',
      options: [
        { value: 'always', label: 'Almost always' },
        { value: 'often', label: 'Often' },
        { value: 'sometimes', label: 'Sometimes' },
        { value: 'rarely', label: 'Rarely' },
        { value: 'never', label: 'Never' },
      ],
    },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 font-sans">
      <Breadcrumb currentStep="pre-survey" />

      <h1 className="text-2xl font-bold text-gray-800 mb-1">Survey on AI Chatbots</h1>
      <p className="text-sm text-gray-500 mb-6">
        We would like to start by understanding your opinion on chatbots and artificial intelligence.
        A chatbot is a computer program that simulates conversations with human users.
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
              <option value="">Select an option</option>
              {q.options.map(opt => (
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

export default PreSurvey;
