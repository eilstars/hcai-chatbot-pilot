import React from 'react';
import Breadcrumb from './Breadcrumb';

const StudyComplete = () => {
    return (
        <div>
            <Breadcrumb currentStep="demographics" />
            <h2>Thank You!</h2>
            <p>You have successfully completed the study. Your participation is greatly appreciated.</p>
            <p>You may now close this window.</p>
        </div>
    );
};

export default StudyComplete;