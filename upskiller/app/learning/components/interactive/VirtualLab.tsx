import React, { useState } from 'react';

interface LabStep {
  instruction: string;
  action: string;
}

interface VirtualLabConfig {
  title: string;
  steps: LabStep[];
}

interface VirtualLabProps {
  config: VirtualLabConfig;
}

const VirtualLab: React.FC<VirtualLabProps> = ({ config }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [labState, setLabState] = useState<{ [key: string]: any }>({});

  const handleStepAction = async () => {
    const step = config.steps[currentStep];
    try {
      // Here you would implement the actual action logic
      // For now, we'll just simulate the action
      await simulateAction(step.action);
      setCompletedSteps(prev => [...prev, currentStep]);
      
      if (currentStep < config.steps.length - 1) {
        setCurrentStep(currentStep + 1);
      }
    } catch (error) {
      console.error('Error executing lab step:', error);
    }
  };

  const simulateAction = async (action: string) => {
    // Simulate different actions based on the action type
    switch (action) {
      case 'setup':
        setLabState(prev => ({ ...prev, isSetup: true }));
        break;
      case 'explore':
        setLabState(prev => ({ ...prev, explored: true }));
        break;
      case 'test':
        setLabState(prev => ({ ...prev, tested: true }));
        break;
      default:
        setLabState(prev => ({ ...prev, [action]: true }));
    }
    
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
  };

  const isStepCompleted = (index: number) => completedSteps.includes(index);

  return (
    <div className="virtual-lab-container">
      <h3 className="lab-title">{config.title}</h3>
      
      <div className="lab-progress">
        {config.steps.map((step, index) => (
          <div
            key={index}
            className={`step-indicator ${
              index === currentStep ? 'active' : ''
            } ${isStepCompleted(index) ? 'completed' : ''}`}
          >
            {index + 1}
          </div>
        ))}
      </div>
      
      <div className="lab-content">
        <div className="step-instruction">
          <h4>Step {currentStep + 1}:</h4>
          <p>{config.steps[currentStep].instruction}</p>
        </div>
        
        <div className="lab-workspace">
          {/* This is where you would render any specific lab interface elements */}
          <div className="lab-status">
            {Object.entries(labState).map(([key, value]) => (
              <div key={key} className="status-item">
                {key}: {String(value)}
              </div>
            ))}
          </div>
        </div>
        
        <div className="lab-controls">
          <button
            onClick={handleStepAction}
            disabled={isStepCompleted(currentStep)}
            className="action-button"
          >
            {isStepCompleted(currentStep) ? 'Completed' : 'Execute Step'}
          </button>
          
          {currentStep > 0 && (
            <button
              onClick={() => setCurrentStep(currentStep - 1)}
              className="nav-button"
            >
              Previous Step
            </button>
          )}
          
          {currentStep < config.steps.length - 1 && isStepCompleted(currentStep) && (
            <button
              onClick={() => setCurrentStep(currentStep + 1)}
              className="nav-button"
            >
              Next Step
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VirtualLab; 