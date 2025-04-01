import React, { useState, useEffect, useRef } from 'react';

interface SimulationConfig {
  type: string;
  topic: string;
  difficulty: string;
  interactive: boolean;
}

interface InteractiveSimulationProps {
  config: SimulationConfig;
}

const InteractiveSimulation: React.FC<InteractiveSimulationProps> = ({ config }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [simulationState, setSimulationState] = useState({
    step: 0,
    data: {} as any
  });

  useEffect(() => {
    if (canvasRef.current) {
      initializeSimulation();
    }
  }, []);

  const initializeSimulation = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set up initial canvas state
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Initialize simulation data based on config
    setSimulationState({
      step: 0,
      data: {
        topic: config.topic,
        difficulty: config.difficulty,
        elements: []
      }
    });
  };

  const updateSimulation = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update simulation state
    setSimulationState(prev => ({
      ...prev,
      step: prev.step + 1
    }));

    // Draw current state
    drawSimulation(ctx);
  };

  const drawSimulation = (ctx: CanvasRenderingContext2D) => {
    // Example visualization - replace with actual simulation logic
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    ctx.fillStyle = '#333';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${config.topic} Simulation`, ctx.canvas.width / 2, 30);
    ctx.fillText(`Step: ${simulationState.step}`, ctx.canvas.width / 2, 60);
  };

  const handlePlay = () => {
    setIsPlaying(true);
    requestAnimationFrame(animate);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setSimulationState({
      step: 0,
      data: {
        topic: config.topic,
        difficulty: config.difficulty,
        elements: []
      }
    });
    initializeSimulation();
  };

  const animate = () => {
    if (!isPlaying) return;
    updateSimulation();
    requestAnimationFrame(animate);
  };

  return (
    <div className="simulation-container">
      <div className="simulation-controls">
        <button
          onClick={isPlaying ? handlePause : handlePlay}
          className="control-button"
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button onClick={handleReset} className="control-button">
          Reset
        </button>
      </div>
      
      <canvas
        ref={canvasRef}
        width={600}
        height={400}
        className="simulation-canvas"
      />
      
      {config.interactive && (
        <div className="interaction-panel">
          <h4>Interaction Controls</h4>
          <div className="control-group">
            <label>Speed:</label>
            <input
              type="range"
              min="1"
              max="10"
              defaultValue="5"
              onChange={(e) => {
                // Implement speed control
              }}
            />
          </div>
          {/* Add more interactive controls based on simulation type */}
        </div>
      )}
      
      <div className="simulation-info">
        <p>Topic: {config.topic}</p>
        <p>Difficulty: {config.difficulty}</p>
        <p>Step: {simulationState.step}</p>
      </div>
    </div>
  );
};

export default InteractiveSimulation; 