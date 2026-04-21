import React, { useState, useContext } from 'react';
import axios from 'axios';
import { UserContext } from '../context/UserContext';
import Breadcrumb from './Breadcrumb';

const DemographicsSurvey = ({ nextProgress }) => {
    const { user, setUser } = useContext(UserContext);
    const [responses, setResponses] = useState({ raceEthnicity: [] });
    const [raceError, setRaceError] = useState('');

    const handleChange = (e) => {
        setResponses(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleRaceToggle = (value) => {
        setRaceError('');
        setResponses((prev) => {
            const existing = Array.isArray(prev.raceEthnicity) ? prev.raceEthnicity : [];
            const next = existing.includes(value)
                ? existing.filter((v) => v !== value)
                : [...existing, value];
            return { ...prev, raceEthnicity: next };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!Array.isArray(responses.raceEthnicity) || responses.raceEthnicity.length === 0) {
            setRaceError('Please select at least one option for Race and Ethnicity.');
            return;
        }

        try {
            const response = await axios.post('http://localhost:5001/api/surveys/submit', {
                participantId: user.participantId,
                surveyType: 'demographics',
                responses,
                nextProgress
            });
            setUser(response.data.user);
        } catch (error) {
            console.error("Error submitting demographics survey:", error);
        }
    };

    return (
        <div className="max-w-2xl mx-auto px-4 py-10 font-sans">
            <Breadcrumb currentStep="demographics" />

            <h1 className="text-2xl font-bold text-gray-800 mb-1">Demographic Information</h1>
            <p className="text-sm text-gray-500 mb-6">
                Please answer the following questions. Your responses are confidential and will only be used for research purposes.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Question 1</p>
                    <label htmlFor="gender" className="block text-base font-semibold text-gray-800 mb-3 leading-snug">
                        To which gender do you most identify?
                    </label>
                    <select
                        id="gender"
                        name="gender"
                        onChange={handleChange}
                        required
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                    >
                        <option value="">Select an option</option>
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                        <option value="custom">Custom</option>
                        <option value="preferNotToAnswer">Prefer not to answer</option>
                    </select>
                </div>

                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Question 2</p>
                    <label htmlFor="age" className="block text-base font-semibold text-gray-800 mb-3 leading-snug">
                        What is your age?
                    </label>
                    <select
                        id="age"
                        name="age"
                        onChange={handleChange}
                        required
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                    >
                        <option value="">Select an option</option>
                        <option value="18-24">18-24</option>
                        <option value="25-34">25-34</option>
                        <option value="35-44">35-44</option>
                        <option value="45-54">45-54</option>
                        <option value="55-64">55-64</option>
                        <option value="65-74">65-74</option>
                        <option value="75+">75 or older</option>
                    </select>
                </div>

                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Question 3</p>
                    <p className="text-base font-semibold text-gray-800 mb-2 leading-snug">
                        Which of the following(s) best describe you?
                    </p>
                    <p className="text-sm text-gray-500 mb-3">You can select more than one option if applicable.</p>

                    <div className="space-y-2">
                        {[
                            { value: 'white', label: 'White' },
                            { value: 'blackOrAfricanAmerican', label: 'Black or African American' },
                            { value: 'asian', label: 'Asian' },
                            { value: 'americanIndianOrAlaskaNative', label: 'American Indian or Alaska Native' },
                            { value: 'nativeHawaiianOrPacificIslander', label: 'Native Hawaiian or Pacific Islander' },
                            { value: 'other', label: 'Other' },
                            { value: 'preferNotToAnswer', label: 'Prefer not to answer' }
                        ].map((opt) => (
                            <label key={opt.value} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl cursor-pointer hover:bg-gray-50">
                                <input
                                    type="checkbox"
                                    checked={(responses.raceEthnicity || []).includes(opt.value)}
                                    onChange={() => handleRaceToggle(opt.value)}
                                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">{opt.label}</span>
                            </label>
                        ))}
                    </div>

                    {raceError && <p className="text-sm text-red-600 mt-2">{raceError}</p>}
                </div>

                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Question 4</p>
                    <label htmlFor="education" className="block text-base font-semibold text-gray-800 mb-3 leading-snug">
                        What is the highest degree or level of school you have completed?
                    </label>
                    <select
                        id="education"
                        name="education"
                        onChange={handleChange}
                        required
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                    >
                        <option value="">Select an option</option>
                        <option value="lessThanHighSchool">Less than a high school diploma</option>
                        <option value="highSchoolOrEquivalent">High school degree or equivalent</option>
                        <option value="someCollegeOrAssociate">Some college or Associate degree (2-year)</option>
                        <option value="bachelors">Bachelor's degree (4-year)</option>
                        <option value="masters">Master's degree</option>
                        <option value="doctorate">Doctorate degree</option>
                        <option value="other">Other</option>
                    </select>
                </div>

                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Question 5</p>
                    <label htmlFor="englishProficiency" className="block text-base font-semibold text-gray-800 mb-3 leading-snug">
                        What is your proficiency level in English?
                    </label>
                    <select
                        id="englishProficiency"
                        name="englishProficiency"
                        onChange={handleChange}
                        required
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                    >
                        <option value="">Select an option</option>
                        <option value="1">1 Elementary Proficiency</option>
                        <option value="2">2 Limited Working Proficiency</option>
                        <option value="3">3 Professional Working Proficiency</option>
                        <option value="4">4 Native/Bilingual Proficiency</option>
                    </select>
                </div>

                <button
                    type="submit"
                    className="w-full py-3 bg-gray-800 text-white font-semibold rounded-xl hover:bg-gray-700 transition-colors duration-150"
                >
                    Finish Study
                </button>
            </form>
        </div>
    );
};
export default DemographicsSurvey;
