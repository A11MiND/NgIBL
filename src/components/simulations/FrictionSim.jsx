import React, { useState, useEffect, useRef, useCallback } from 'react';

// Define the component containing the core simulation logic and UI
const FrictionSimulation = () => {
  // --- State Variables for Simulation Parameters ---
  const [tension, setTension] = useState(35);
  const [mass, setMass] = useState(2.5);
  const [theta, setTheta] = useState(30);
  const [muS, setMuS] = useState(0.5);
  const [muK, setMuK] = useState(0.4);

  // --- State Variables for Simulation Dynamics ---
  const [v, setV] = useState(0); // velocity
  const [x, setX] = useState(50); // position
  const [running, setRunning] = useState(false);

  // --- Ref for Canvas and Animation Loop ---
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastTimeRef = useRef(null);
  
  // Gravitational acceleration constant
  const g = 9.81;
  
  // --- Physics Calculation Function ---
  const physics = useCallback((dt) => {
    const angle = theta * Math.PI / 180;
    
    // Components of the Tension force
    const Tx = tension * Math.cos(angle);
    const Ty = tension * Math.sin(angle);

    // Normal force (N = W - Ty). Must be at least 0.
    const N = Math.max(0, mass * g - Ty);

    // Maximum static friction and kinetic friction
    const fStaticMax = muS * N;
    const fKinetic = muK * N;

    let a = 0; // acceleration
    
    if (v === 0) {
      // If the box is still, check if Tx exceeds max static friction
      if (Tx > fStaticMax) {
        // Starts moving, use kinetic friction
        a = (Tx - fKinetic) / mass;
      } else {
        // Stays still
        a = 0;
      }
    } else {
      // Box is already moving, use kinetic friction
      // Use sign of velocity for friction direction, although Tx should dominate
      const friction = fKinetic;
      a = (Tx - friction) / mass;
    }

    // Update velocity and position
    let newV = v + a * dt;
    // Velocity cannot be negative (unless braking, but here we simplify)
    if (newV < 0) newV = 0; 

    // Scale factor (50) is used to make the position change visually noticeable on the canvas
    const newX = x + newV * dt * 50; 

    // Update state using the functional form to ensure correctness in the animation loop
    setV(newV);
    setX(prevX => {
        const canvasWidth = canvasRef.current ? canvasRef.current.width : 900;
        // Keep the box within the visible area (50 to canvasWidth - 60)
        return Math.min(Math.max(50, newX), canvasWidth - 60);
    });
    
  }, [tension, mass, theta, muS, muK, v, x]);


  // --- Drawing Function ---
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the box
    ctx.fillStyle = '#d59a7f'; // Box color
    ctx.fillRect(x, 180, 60, 60); // (x, y, width, height)

    // Draw the horizontal surface
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 240);
    ctx.lineTo(canvas.width, 240);
    ctx.stroke();
    ctx.lineWidth = 1; // Reset

    // Draw the Tension force vector (T)
    const boxCenterX = x + 30;
    const boxCenterY = 210;
    const arrowLength = 50; // Visual length of the arrow
    const angleRad = theta * Math.PI / 180;
    
    // Calculate the end point of the arrow
    const endX = boxCenterX + arrowLength * Math.cos(angleRad);
    const endY = boxCenterY - arrowLength * Math.sin(angleRad); // Minus because canvas Y is inverted

    ctx.strokeStyle = 'red';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(boxCenterX, boxCenterY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    
    // Draw arrow head (simple triangle)
    const headLen = 8;
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - headLen * Math.cos(angleRad - Math.PI / 6), endY - headLen * Math.sin(angleRad - Math.PI / 6));
    ctx.lineTo(endX - headLen * Math.cos(angleRad + Math.PI / 6), endY - headLen * Math.sin(angleRad + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
    
    ctx.lineWidth = 1; // Reset line width

  }, [x, theta]);


  // --- Animation Loop ---
  const animate = useCallback((timestamp) => {
    if (!lastTimeRef.current) lastTimeRef.current = timestamp;
    const dt = (timestamp - lastTimeRef.current) / 1000; // time delta in seconds
    lastTimeRef.current = timestamp;

    // Use functional updates inside physics to ensure we operate on the latest state
    if (running) {
      physics(dt); 
    }

    draw(); // Redraw the canvas
    
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [running, physics, draw]);


  // --- useEffect to Start/Stop the Animation Loop ---
  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [animate]);
  
  
  // --- Handler for Reset Button ---
  const handleReset = () => {
    setRunning(false);
    setV(0);
    setX(50);
    lastTimeRef.current = null; // Reset time reference for smooth restart
  };


  // --- JSX structure (Render) ---
  return (
    <div className="p-4 sm:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-xl shadow-2xl">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 border-b pb-2">
          Friction: Pulling a Box on a Horizontal Surface
        </h1>

        {/* Status Dashboard */}
        <div className="mb-4 p-3 bg-indigo-50 rounded-lg text-indigo-800 font-mono text-sm shadow-inner">
          <p className="flex justify-between flex-wrap">
            <span>Status: <span className={`font-bold ${running ? 'text-green-600' : 'text-yellow-600'}`}>{running ? 'RUNNING' : 'PAUSED'}</span></span>
            <span>Velocity: <span className="font-bold">{v.toFixed(2)} m/s</span></span>
            <span>Position: <span className="font-bold">{(x / 50).toFixed(2)} m</span> (Scaled)</span>
          </p>
        </div>

        {/* Control Buttons */}
        <div className="flex space-x-4 mb-8">
          <button 
            onClick={() => setRunning(true)} 
            className="flex-1 px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 transition-colors disabled:opacity-50"
            disabled={running}
          >
            Start
          </button>
          <button 
            onClick={() => setRunning(false)} 
            className="flex-1 px-6 py-3 bg-yellow-500 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-600 transition-colors disabled:opacity-50"
            disabled={!running}
          >
            Pause
          </button>
          <button 
            onClick={handleReset} 
            className="flex-1 px-6 py-3 bg-red-500 text-white font-semibold rounded-lg shadow-md hover:bg-red-600 transition-colors"
          >
            Reset
          </button>
        </div>

        {/* Sliders */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mb-8">
          
          {/* Tension Slider */}
          <SliderControl 
            label="Tension (T) in Newtons (N)" 
            value={tension} 
            min={0} max={100} step={1} 
            setValue={setTension} 
            displayValue={tension.toFixed(0)}
          />

          {/* Mass Slider */}
          <SliderControl 
            label="Mass (m) in Kilograms (kg)" 
            value={mass} 
            min={0.5} max={10} step={0.1} 
            setValue={setMass} 
            displayValue={mass.toFixed(1)}
          />

          {/* Theta Slider */}
          <SliderControl 
            label="Angle (θ) in Degrees (°)" 
            value={theta} 
            min={0} max={80} step={1} 
            setValue={setTheta} 
            displayValue={theta.toFixed(0)}
          />

          {/* Mu_S (Static Friction) Slider */}
          <SliderControl 
            label="Coefficient of Static Friction (μs)" 
            value={muS} 
            min={0} max={1} step={0.01} 
            setValue={setMuS} 
            displayValue={muS.toFixed(2)}
          />
          
          {/* Mu_K (Kinetic Friction) Slider */}
          <SliderControl 
            label="Coefficient of Kinetic Friction (μk)" 
            value={muK} 
            min={0} max={1} step={0.01} 
            setValue={setMuK} 
            displayValue={muK.toFixed(2)}
          />
        </div>
        
        {/* Canvas Area */}
        <div className="border border-gray-300 rounded-lg overflow-hidden shadow-xl">
          <canvas 
            ref={canvasRef} 
            width="900" 
            height="300"
            className="w-full bg-white block"
          />
        </div>
        
      </div>
    </div>
  );
};

// Helper component for Sliders
const SliderControl = ({ label, value, min, max, step, setValue, displayValue }) => (
  <div className="slider-group">
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label}: <span className="font-bold text-indigo-600">{displayValue}</span>
    </label>
    <input 
      type="range" 
      min={min} 
      max={max} 
      step={step} 
      value={value} 
      onChange={(e) => setValue(parseFloat(e.target.value))}
      className="w-full h-2 bg-indigo-100 rounded-lg appearance-none cursor-pointer range-lg transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500"
    />
  </div>
);

// Main App component to render the simulation
const App = () => {
    return (
        // The script to load Tailwind is included here for runtime styling
        <>
            <script src="https://cdn.tailwindcss.com"></script>
            <FrictionSimulation />
        </>
    );
};

export default App;