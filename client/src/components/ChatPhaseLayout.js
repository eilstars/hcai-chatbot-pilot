import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { UserContext } from '../context/UserContext';
import Chatbot from './Chatbot';

const ChatPhaseLayout = ({ round, preTestType, nextProgress, testTypeToSubmit }) => {
    const { user, setUser } = useContext(UserContext);
    const [preTestResults, setPreTestResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get(`http://localhost:5001/api/tests/full-results/${user.participantId}/${preTestType}`);
                setPreTestResults(response.data.fullResults);
            } catch (error) {
                console.error("Error fetching pre-test results:", error);
                setFetchError(true);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user.participantId, preTestType]);

    const handleComplete = async () => {
        try {
            const response = await axios.post('http://localhost:5001/api/users/update-progress', {
                participantId: user.participantId,
                progress: nextProgress
            });
            setUser(response.data);
        } catch (error) {
            console.error("Error advancing study:", error);
        }
    };

    if (loading) return <div className="p-20 text-center text-gray-500">Loading your results...</div>;

    if (fetchError || preTestResults.length === 0) {
        return (
            <div className="max-w-md mx-auto mt-20 p-8 bg-white border border-gray-100 rounded-2xl shadow-sm text-center">
                <p className="text-lg font-semibold text-gray-700 mb-2">Could not load your pre-test results.</p>
                <p className="text-sm text-gray-400 mb-6">Please make sure you completed the pre-test, then try refreshing the page.</p>
                <button onClick={() => window.location.reload()} className="px-6 py-2 bg-gray-800 text-white rounded-xl text-sm font-semibold hover:bg-gray-700">
                    Retry
                </button>
            </div>
        );
    }

    return (
        <Chatbot 
            participantId={user.participantId}
            round={round}
            preTestResults={preTestResults}
            testTypeToSubmit={testTypeToSubmit}
            onComplete={handleComplete}
        />
    );
};

export default ChatPhaseLayout;
