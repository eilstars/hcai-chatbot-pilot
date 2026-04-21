import React, { useState, useContext } from 'react';
import axios from 'axios';
import { UserContext } from '../context/UserContext';

const ParticipantLogin = () => {
    const [participantId, setParticipantId] = useState('');
    const [error, setError] = useState('');
    const { setUser } = useContext(UserContext);

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!participantId) {
            setError('Please enter your Participant ID.');
            return;
        }
        try {
        // API call to the backend login endpoint
            const response = await axios.post('http://localhost:5001/api/users/login', {
            participantId
            });

// --- ADD THIS LINE ---
        console.log('Data received from server:', response.data);

        setUser(response.data); // On success, set the user in the global context
        } catch (err) {
            setError('An error occurred. Please check the ID and try again.');
            console.error(err);
        }
    };

    return (
    <div>
        <h2>Welcome to the Study</h2>
        <p>Please enter your assigned Participant ID to begin.</p>
        <form onSubmit={handleLogin}>
        <input
            type="text"
            placeholder="Enter your ID"
            value={participantId}
            onChange={(e) => setParticipantId(e.target.value)}
            style={{ padding: '8px', marginRight: '10px' }}
        />
        <button type="submit">Start Study</button>
        {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
        </form>
    </div>
    );
};

export default ParticipantLogin;
