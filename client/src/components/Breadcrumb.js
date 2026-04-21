import React from 'react';

const Breadcrumb = ({ currentStep }) => {
  // Define all steps in the study flow
    const steps = [
        { id: 'consent', label: 'Consent' },
        { id: 'pre-survey', label: 'Survey on AI' },
        { id: 'pretest', label: 'Pre-Test' },
        { id: 'learning-1', label: 'Learning Session' },
        { id: 'post-survey', label: 'Post Survey' },
        { id: 'demographics', label: 'Demographics Survey' }
    ];

    return (
        <nav className="flex items-center justify-center space-x-1 py-3 mb-6 border-b border-gray-100">
        {steps.map((step, index) => {
            const isActive = currentStep === step.id;
            const isPast = steps.findIndex(s => s.id === currentStep) > index;

            return (
            <React.Fragment key={step.id}>
                <div className="flex items-center">
                <span 
                    className={`text-xs px-1.5 py-0.5 rounded transition-colors duration-200 ${
                    isActive 
                        ? 'text-blue-600 font-bold underline decoration-2 underline-offset-2' 
                        : isPast 
                        ? 'text-green-600' 
                        : 'text-gray-400'
                    }`}
                >
                    {step.label}
                </span>
                </div>
                {index < steps.length - 1 && (
                <span className="text-gray-300 mx-0.5 text-xs">/</span>
                )}
            </React.Fragment>
            );
        })}
        </nav>
    );
};

export default Breadcrumb;