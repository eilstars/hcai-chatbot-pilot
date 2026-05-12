import React, { useContext } from 'react';
import Breadcrumb from './Breadcrumb';
import { UserContext } from '../context/UserContext';

const StudyComplete = () => {
    const { user } = useContext(UserContext);

    return (
        <>
            <Breadcrumb currentStep="demographics" />
            <div style={styles.container}>
            <div style={styles.card}>
                <h1 style={styles.title}>Thank You!</h1>
                <p style={styles.subtitle}>
                    You have successfully completed the study. Your participation is greatly appreciated.
                </p>
                <p style={styles.description}>
                    Please enter the following completion code into Prolific to verify your participation:
                </p>
                <div style={styles.codeContainer}>
                    <code style={styles.code}>{user?.completionCode || 'COMPLETION_CODE'}</code>
                </div>
            </div>
        </div>
        </>
    );
};

const styles = {
    container: {
        minHeight: 'calc(100vh - 60px)',
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
        maxWidth: '500px',
        width: '100%',
        textAlign: 'center',
    },
    title: {
        fontSize: '28px',
        fontWeight: '700',
        color: '#1a1a1a',
        margin: '0 0 16px 0',
    },
    subtitle: {
        fontSize: '16px',
        color: '#333',
        margin: '0 0 20px 0',
        lineHeight: '1.6',
        fontWeight: '500',
    },
    description: {
        fontSize: '15px',
        color: '#666',
        margin: '0 0 24px 0',
        lineHeight: '1.6',
    },
    codeContainer: {
        background: '#f5f5f5',
        borderRadius: '8px',
        padding: '16px',
        margin: '24px 0',
        border: '2px solid #e1e1e1',
    },
    code: {
        fontSize: '18px',
        fontWeight: '600',
        color: '#007bff',
    },
    footer: {
        fontSize: '14px',
        color: '#999',
        margin: '20px 0 0 0',
        fontStyle: 'italic',
    },
};

export default StudyComplete;