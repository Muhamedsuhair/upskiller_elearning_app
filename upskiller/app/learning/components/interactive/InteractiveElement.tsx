import React from 'react';
import CodePlayground from './CodePlayground';
import VirtualLab from './VirtualLab';
import InteractiveSimulation from './InteractiveSimulation';
import DragDrop from './DragDrop';
import RevealSteps from './RevealSteps';

interface InteractiveElementProps {
  type: 'playground' | 'lab' | 'simulation' | 'drag-drop' | 'reveal';
  config: any;
  title: string;
}

const InteractiveElement: React.FC<InteractiveElementProps> = ({ type, config, title }) => {
  const renderElement = () => {
    switch (type) {
      case 'playground':
        return <CodePlayground config={config} />;
      case 'lab':
        return <VirtualLab config={config} />;
      case 'simulation':
        return <InteractiveSimulation config={config} />;
      case 'drag-drop':
        return <DragDrop config={config} />;
      case 'reveal':
        return <RevealSteps config={config} />;
      default:
        return <div>Unsupported interactive element type</div>;
    }
  };

  return (
    <div className="interactive-element">
      <h3 className="interactive-title">{title}</h3>
      {renderElement()}
    </div>
  );
};

export default InteractiveElement; 