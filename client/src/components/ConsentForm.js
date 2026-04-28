import React, { useState, useContext } from 'react';
import axios from 'axios';
import { UserContext } from '../context/UserContext';
import Breadcrumb from './Breadcrumb';
import consentFormPdf from '../Consent Form - Prolific Study.pdf';

const styles = {
    page: {
        maxWidth: '760px',
        margin: '0',
        padding: '2rem 1.5rem 3rem',
        textAlign: 'left',
        color: '#222',
        lineHeight: '1.7',
        fontSize: '0.95rem',
    },
    institution: {
        fontSize: '0.85rem',
        color: '#666',
        marginBottom: '0.25rem',
    },
    title: {
        fontSize: '1.5rem',
        fontWeight: '600',
        marginBottom: '0.25rem',
        color: '#111',
    },
    subtitle: {
        fontSize: '0.9rem',
        color: '#666',
        marginBottom: '1.5rem',
    },
    metaBlock: {
        backgroundColor: '#f6f6f6',
        borderRadius: '6px',
        padding: '0.85rem 1.25rem',
        marginBottom: '1.75rem',
        fontSize: '0.9rem',
        lineHeight: '1.6',
    },
    metaRow: {
        marginBottom: '0.2rem',
    },
    section: {
        marginBottom: '1.5rem',
    },
    sectionHeading: {
        fontSize: '1rem',
        fontWeight: '600',
        color: '#111',
        marginBottom: '0.4rem',
    },
    paragraph: {
        margin: '0 0 0.5rem 0',
    },
    divider: {
        border: 'none',
        borderTop: '1px solid #e0e0e0',
        margin: '2rem 0',
    },
    checkboxGroup: {
        backgroundColor: '#f9f9f9',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        padding: '1.25rem 1.5rem',
        marginBottom: '1.5rem',
    },
    checkboxGroupTitle: {
        fontSize: '0.95rem',
        fontWeight: '600',
        marginBottom: '1rem',
        color: '#111',
    },
    checkboxLabel: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.65rem',
        marginBottom: '0.75rem',
        cursor: 'pointer',
    },
    checkbox: {
        marginTop: '3px',
        width: '16px',
        height: '16px',
        flexShrink: 0,
        cursor: 'pointer',
    },
    continueBtn: {
        display: 'block',
        padding: '0.65rem 2rem',
        backgroundColor: '#333',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        fontSize: '0.95rem',
        fontWeight: '600',
        cursor: 'pointer',
    },
    continueBtnDisabled: {
        backgroundColor: '#bbb',
        cursor: 'not-allowed',
    },
    printNote: {
        fontSize: '0.85rem',
        color: '#666',
        marginBottom: '0.75rem',
    },
    downloadLink: {
        display: 'inline-block',
        marginBottom: '1.25rem',
        fontSize: '0.9rem',
        fontWeight: '600',
        color: '#1d4ed8',
        textDecoration: 'none',
    },
};

const CHECKBOXES = [
    { id: 'age',      label: 'I am 18 years or older.' },
    { id: 'location', label: 'I am currently physically located in the United States.' },
    { id: 'read',     label: 'I have read and understood the above information.' },
    { id: 'agree',    label: 'I voluntarily agree to participate in this research.' },
];

const ConsentForm = () => {
    const [checked, setChecked] = useState({ age: false, location: false, read: false, agree: false });
    const { user, setUser } = useContext(UserContext);

    const allChecked = Object.values(checked).every(Boolean);

    const toggle = (id) => setChecked(prev => ({ ...prev, [id]: !prev[id] }));

    const handleContinue = async () => {
        if (!allChecked) return;
        try {
            const response = await axios.post('/api/users/update-progress', {
                participantId: user.participantId,
                progress: 'pre-survey',
                consented: true
            });
            setUser(response.data);
        } catch (error) {
            console.error('Error updating progress:', error);
        }
    };

    return (
        <div style={styles.page}>
            <Breadcrumb currentStep="consent" />

            {/* Header */}
            <h1 style={styles.title}>Consent Form</h1>
            <p style={styles.subtitle}>The Use of Conversational Agents in Microeconomic Learning</p>

            {/* PI info block */}
            <div>
                <div><strong>Principal Investigator:</strong> Dr. Tiffany (Wenting) Li</div>
                <div><strong>Department:</strong> Department of Computer Science, Stevens Institute of Technology</div>
                <div><strong>Contact:</strong> wli69@stevens.edu &nbsp;|&nbsp; 201.216.3751</div>
            </div>

            {/* Summary */}
            <div style={styles.section}>
                <h2 style={styles.sectionHeading}>Summary</h2>
                <p style={styles.paragraph}>
                    You are being asked to participate in a voluntary research study. The purpose of the study is to
                    understand how learners leverage chatbots as they learn microeconomics. The study should take
                    approximately 30 minutes. Risks are minimal; participation in this study does not
                    entail any cognitive, physical, or emotional risks beyond those of everyday life. By participating,
                    you will not only learn something new in microeconomics, but also help us design better
                    conversational agents that help future learners engage in more effective learning.
                </p>
            </div>

            {/* Procedures */}
            <div style={styles.section}>
                <h2 style={styles.sectionHeading}>What Procedures Are Involved?</h2>
                <p style={styles.paragraph}>
                    Participating in this study will first involve answering 8 multiple-choice questions on
                    microeconomics. Next, you will be asked to work on the same 8 problems again and understand the
                    concepts behind them. You will have access to a regular state-of-the-art generative chatbot (similar
                    to ChatGPT) in the process. You will receive feedback upon submitting each problem. Finally, you
                    will answer a few demographic questions. Lastly, you will receive a completion code in the
                    survey and be asked to paste it into the Prolific task page.
                </p>
            </div>

            {/* Risks */}
            <div style={styles.section}>
                <h2 style={styles.sectionHeading}>What Potential Risks Are Involved?</h2>
                <p style={styles.paragraph}>
                    The risks of the study are minimal. This study may use advice or information created by a computer
                    program called artificial intelligence (AI). Sometimes AI can make mistakes, leave out important
                    details, or exhibit unfair bias. The research team will check the information, but there is still a
                    small chance that something it produces may be wrong or not fit your situation. These risks are
                    similar to those you encounter when using state-of-the-art commercial chatbots (such as ChatGPT and
                    Gemini). AI advice should not replace help from a trained professional. If anything is confusing or
                    doesn&apos;t seem right, you can contact the researchers at any time.
                </p>
                <p style={styles.paragraph}>
                    You may also feel unsure when faced with unfamiliar concepts, nervous about taking a test, and upset
                    when you get problems wrong. These risks are similar to those you experience when learning new
                    materials or skills at school or at work. If you feel these emotions, you can contact the researcher,
                    who will point you to available resources to help.
                </p>
            </div>

            {/* Benefits */}
            <div style={styles.section}>
                <h2 style={styles.sectionHeading}>What Potential Benefits Are There?</h2>
                <p style={styles.paragraph}>
                    There are no direct benefits to you from taking part in this study. But as you participate, you may
                    learn something new about Microeconomics. By participating, you can help us develop a better
                    understanding of how learners use conversational agents during learning. With this knowledge, we can
                    improve the current design of chatbots to better support future learners.
                </p>
            </div>

            {/* Reimbursement */}
            <div style={styles.section}>
                <h2 style={styles.sectionHeading}>Will I Be Reimbursed?</h2>
                <p style={styles.paragraph}>
                    You will receive an $8 payment for completing the study.
                </p>
            </div>

            {/* Withdrawal */}
            <div style={styles.section}>
                <h2 style={styles.sectionHeading}>Can I Withdraw or Be Removed from the Study?</h2>
                <p style={styles.paragraph}>
                    If you decide to participate, you are free to withdraw your consent by contacting the researchers
                    and discontinue participation at any time. Your participation in this research is voluntary. We will
                    delete your data once you withdraw your consent. Your decision whether or not to participate, or
                    to withdraw after beginning participation, will not affect your performance statistics on Prolific.
                </p>
            </div>

            {/* Privacy */}
            <div style={styles.section}>
                <h2 style={styles.sectionHeading}>How Will the Researchers Protect My Information?</h2>
                <p style={styles.paragraph}>
                    In this study, the only identifier we collect from you is your platform identifier. It will be
                    stored separately from the rest of the research data, deleted permanently after 3 years, and will
                    not be published or presented.
                </p>
            </div>

            {/* Access */}
            <div style={styles.section}>
                <h2 style={styles.sectionHeading}>Who Will Have Access to the Information Collected?</h2>
                <p style={styles.paragraph}>
                    Efforts will be made to limit the use and disclosure of your personal information, including
                    research study records, to those who have a need to review it. We cannot promise complete secrecy.
                    There are reasons why information about you may be used or seen by other people beyond the research
                    team during or after this study. For example, university officials, government officials, study
                    funders, auditors, and the Institutional Review Board may need access to study information to ensure
                    the study is conducted safely and appropriately.
                </p>
            </div>

            {/* Future sharing */}
            <div style={styles.section}>
                <h2 style={styles.sectionHeading}>How Might the Information Be Shared in the Future?</h2>
                <p style={styles.paragraph}>
                    We will retain the de-identified information we collect about you for recordkeeping purposes. The
                    information will not be shared with anyone outside of the research team.
                </p>
            </div>

            {/* Contact */}
            <div style={styles.section}>
                <h2 style={styles.sectionHeading}>Who Should I Contact If I Have Questions?</h2>
                <p style={styles.paragraph}>
                    If you have any questions about this study or your part in it, or if you have concerns or complaints
                    about the research, please feel free to contact any of the researchers:
                </p>
                <ul style={{ margin: '0.25rem 0 0.5rem 1.25rem', fontSize: '0.95rem' }}>
                    <li>Eiliyah Sarowar &mdash; <a href="mailto:esarowar@stevens.edu">esarowar@stevens.edu</a></li>
                    <li>Tiffany Li &mdash; <a href="mailto:wli69@stevens.edu">wli69@stevens.edu</a></li>
                </ul>
            </div>

            {/* Rights */}
            <div style={styles.section}>
                <h2 style={styles.sectionHeading}>What Are My Rights as a Research Subject?</h2>
                <p style={styles.paragraph}>
                    If you have any questions about your rights as a research subject, including concerns, complaints,
                    or to offer input, you may email the Stevens Institutional Review Board (IRB) at{' '}
                    <a href="mailto:IRB@stevens.edu">IRB@stevens.edu</a>. You will have the option to provide feedback
                    or concerns anonymously or you may provide your name and contact information for follow-up purposes.
                </p>
            </div>

            <hr style={styles.divider} />

            {/* Consent checkboxes */}
            <p style={styles.printNote}>
                Please print this consent form if you would like to retain a copy for your records.
            </p>
            <a
                href={consentFormPdf}
                download="Consent Form - Prolific Study.pdf"
                style={styles.downloadLink}
            >
                Download consent form (PDF)
            </a>

            <div style={styles.checkboxGroup}>
                <p style={styles.checkboxGroupTitle}>To proceed, please confirm all of the following:</p>
                {CHECKBOXES.map(({ id, label }) => (
                    <label key={id} style={styles.checkboxLabel}>
                        <input
                            type="checkbox"
                            style={styles.checkbox}
                            checked={checked[id]}
                            onChange={() => toggle(id)}
                        />
                        <span>{label}</span>
                    </label>
                ))}
            </div>

            <button
                onClick={handleContinue}
                disabled={!allChecked}
                style={{ ...styles.continueBtn, ...(!allChecked ? styles.continueBtnDisabled : {}) }}
            >
                Continue
            </button>
        </div>
    );
};

export default ConsentForm;
