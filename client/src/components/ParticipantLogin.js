import React, { useState, useContext } from 'react';
import axios from 'axios';
import { UserContext } from '../context/UserContext';

const ParticipantLogin = () => {
    const [prolificId, setProlificId] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { setUser } = useContext(UserContext);

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!prolificId.trim()) {
            setError('Please enter your Prolific ID.');
            return;
        }
        setLoading(true);
        try {
            const response = await axios.post('/api/users/login', {
                participantId: prolificId
            });

            console.log('Data received from server:', response.data);
            setUser(response.data);
        } catch (err) {
            setError('An error occurred. Please check the ID and try again.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <h1 style={styles.title}>Welcome to the Study</h1>
                <p style={styles.subtitle}>Please enter your Prolific ID to begin.</p>
                <form onSubmit={handleLogin} style={styles.form}>
                    <input
                        type="text"
                        placeholder="Enter your Prolific ID..."
                        value={prolificId}
                        onChange={(e) => setProlificId(e.target.value)}
                        disabled={loading}
                        style={styles.input}
                        autoFocus
                    />
                    <button 
                        type="submit" 
                        disabled={loading}
                        style={{...styles.button, opacity: loading ? 0.6 : 1}}
                    >
                        {loading ? 'Loading...' : 'Start Study'}
                    </button>
                </form>
                {error && <p style={styles.error}>{error}</p>}
            </div>
        </div>
    );
};

const styles = {
    container: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
    },
    card: {
        background: 'white',
        borderRadius: '12px',
        padding: '48px 40px',
        maxWidth: '400px',
        width: '100%',
    },
    title: {
        fontSize: '28px',
        fontWeight: '700',
        color: '#1a1a1a',
        margin: '0 0 12px 0',
        textAlign: 'center',
    },
    subtitle: {
        fontSize: '16px',
        color: '#666',
        textAlign: 'center',
        margin: '0 0 32px 0',
        lineHeight: '1.5',
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
    },
    input: {
        padding: '12px 16px',
        fontSize: '16px',
        border: '2px solid #e1e1e1',
        borderRadius: '8px',
        transition: 'all 0.3s ease',
        fontFamily: 'inherit',
        boxSizing: 'border-box',
        outline: 'none',
    },
    button: {
        padding: '12px 24px',
        fontSize: '16px',
        fontWeight: '600',
        border: '2px solid #007bff',
        borderRadius: '8px',
        background: '#007bff',
        color: 'white',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
    },
    error: {
        color: '#d32f2f',
        fontSize: '14px',
        margin: '12px 0 0 0',
        textAlign: 'center',
        fontWeight: '500',
    },
};

export default ParticipantLogin;
