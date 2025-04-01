import React, { useState } from 'react';

interface Step {
  title: string;
  content: string;
}

interface RevealStepsConfig {
  steps: Step[];
}

interface RevealStepsProps {
  config: RevealStepsConfig;
}

const RevealSteps: React.FC<RevealStepsProps> = ({ config }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [revealedSteps, setRevealedSteps] = useState<number[]>([0]);

  const handleNextStep = () => {
    if (currentStep < config.steps.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      setRevealedSteps(prev => [...prev, nextStep]);
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStepClick = (index: number) => {
    if (revealedSteps.includes(index)) {
      setCurrentStep(index);
    }
  };

  return (
    <div className="reveal-steps-container">
      <div className="steps-progress">
        {config.steps.map((step, index) => (
          <div
            key={index}
            className={`step-indicator ${
              revealedSteps.includes(index) ? 'revealed' : ''
            } ${currentStep === index ? 'active' : ''}`}
            onClick={() => handleStepClick(index)}
          >
            {index + 1}
          </div>
        ))}
      </div>
      
      <div className="step-content">
        <h4 className="step-title">{config.steps[currentStep].title}</h4>
        <div className="step-body">{config.steps[currentStep].content}</div>
      </div>
      
      <div className="step-controls">
        <button
          onClick={handlePreviousStep}
          disabled={currentStep === 0}
          className="step-button"
        >
          Previous
        </button>
        <button
          onClick={handleNextStep}
          disabled={currentStep === config.steps.length - 1}
          className="step-button"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default RevealSteps; 