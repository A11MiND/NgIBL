import React, { useState, useEffect, useRef } from 'react';
import { Search, Microscope, FlaskConical, Info, CheckCircle, XCircle, Play, RotateCcw, Power } from 'lucide-react';

// --- Data & Assets ---

// Sample Definitions
const SAMPLES = [
  { 
    id: 'none', 
    name: 'No Sample Selected', 
    type: 'none', 
    isAlive: false, 
    desc: 'Select a sample from the Landscape tab.',
    color: '#e2e8f0' 
  },
  { 
    id: 'muscle', 
    name: 'Human Muscle', 
    type: 'animal', 
    isAlive: true, 
    desc: 'Tissue from the human leg. Rich in mitochondria.',
    color: '#fca5a5', // Pinkish
    pattern: 'muscle'
  },
  { 
    id: 'leaf', 
    name: 'Maple Leaf', 
    type: 'plant', 
    isAlive: true, 
    desc: 'Leaf tissue containing chloroplasts.',
    color: '#86efac', // Green
    pattern: 'plant'
  },
  { 
    id: 'cow', 
    name: 'Cow Skin', 
    type: 'animal', 
    isAlive: true, 
    desc: 'Epithelial cells from the cow.',
    color: '#e5e5e5', // White/Black spot
    pattern: 'animal_skin'
  },
  { 
    id: 'frog', 
    name: 'Frog Blood', 
    type: 'animal', 
    isAlive: true, 
    desc: 'Amphibian red blood cells (nucleated).',
    color: '#ef4444', 
    pattern: 'blood'
  },
  { 
    id: 'rock', 
    name: 'Grey Rock', 
    type: 'mineral', 
    isAlive: false, 
    desc: 'Inorganic mineral sample.',
    color: '#94a3b8', 
    pattern: 'mineral'
  }
];

// --- Components ---

const BiologyLabSim = () => {
  const [activeTab, setActiveTab] = useState('landscape');
  const [selectedSampleId, setSelectedSampleId] = useState('none');
  const [showLabels, setShowLabels] = useState(false);

  // Microscope State
  const [magnification, setMagnification] = useState(40); // 40, 100, 400
  const [focusLevel, setFocusLevel] = useState(50); // 0-100. Target is 50.
  const [stageX, setStageX] = useState(50);
  const [stageY, setStageY] = useState(50);

  // Lab Test State
  const [isIncubatorOn, setIsIncubatorOn] = useState(false);
  const [testProgress, setTestProgress] = useState(0); // 0 to 100%
  const [hasRunTest, setHasRunTest] = useState(false);

  const currentSample = SAMPLES.find(s => s.id === selectedSampleId) || SAMPLES[0];

  // Reset incubator if sample changes
  useEffect(() => {
    setIsIncubatorOn(false);
    setTestProgress(0);
    setHasRunTest(false);
  }, [selectedSampleId]);

  // Lab Test Animation Loop
  useEffect(() => {
    let interval;
    if (isIncubatorOn && testProgress < 100) {
      interval = setInterval(() => {
        setTestProgress(prev => Math.min(prev + 1, 100));
      }, 50);
    } else if (testProgress >= 100) {
      setHasRunTest(true);
    }
    return () => clearInterval(interval);
  }, [isIncubatorOn, testProgress]);

  // --- Render Functions ---

  const renderSidebar = () => (
    <div className="w-80 bg-white border-l border-slate-300 p-4 flex flex-col shadow-lg z-10 h-full overflow-y-auto">
      <div className="bg-orange-500 text-white px-3 py-1 rounded-tl-lg rounded-br-lg self-end mb-4 text-xs font-bold shadow-sm">
        Tools 🔬
      </div>
      
      <h3 className="font-bold text-lg mb-2 border-b pb-2">Instructions:</h3>
      <p className="text-sm text-slate-600 mb-6">
        {activeTab === 'landscape' && "Click on objects in the scene to collect a sample. Explore hidden samples like the frog or mushroom!"}
        {activeTab === 'microscope' && "Adjust magnification and use the Coarse/Fine focus sliders to get a clear view. Move the stage to scan the slide."}
        {activeTab === 'lab' && "Turn the incubator switch ON to test for ATP (energy) and Respiration. Compare your sample to the controls."}
      </p>

      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 mb-4">
        <h4 className="font-bold text-slate-800 mb-2">Current Sample</h4>
        {currentSample.id !== 'none' ? (
          <div className="flex flex-col items-center animate-fade-in">
            <div 
              className="w-16 h-16 rounded-full border-2 border-white shadow-md mb-2"
              style={{ backgroundColor: currentSample.color }}
            />
            <div className="font-bold text-orange-600 text-lg">{currentSample.name}</div>
            <div className="text-xs text-slate-500 text-center mt-1">{currentSample.desc}</div>
          </div>
        ) : (
          <div className="text-slate-400 italic text-center text-sm py-4">
            No sample loaded. Go to Landscape to pick one.
          </div>
        )}
      </div>

      <div className="mt-auto">
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
          <input 
            type="checkbox" 
            checked={showLabels} 
            onChange={(e) => setShowLabels(e.target.checked)}
            className="rounded text-orange-500 focus:ring-orange-500" 
          />
          Show informational labels
        </label>
      </div>
    </div>
  );

  const renderLandscape = () => (
    <div className="relative w-full h-full bg-gradient-to-b from-blue-200 to-blue-100 overflow-hidden select-none group">
      {/* Sky & Background */}
      <div className="absolute top-10 left-20 opacity-50 animate-pulse text-yellow-200">
          {/* Sun/Glarea */}
          <div className="w-24 h-24 bg-yellow-100 rounded-full blur-xl"></div>
      </div>

      {/* Ground */}
      <div className="absolute bottom-0 w-full h-1/3 bg-gradient-to-t from-green-800 to-green-600 rounded-t-[50%_20%] scale-110 origin-bottom"></div>

      {/* Tree */}
      <div 
        className="absolute left-[-50px] bottom-10 w-80 h-full cursor-pointer transition-transform hover:scale-105"
        onClick={() => setSelectedSampleId('leaf')}
      >
        <div className="w-32 h-[120%] bg-stone-700 absolute left-20 bottom-0 rounded-lg"></div>
        <div className="w-96 h-96 bg-green-700 rounded-full opacity-90 absolute top-0 left-[-50px] blur-sm"></div>
        <div className="w-80 h-80 bg-green-600 rounded-full opacity-90 absolute top-10 left-0"></div>
        {showLabels && <div className="absolute top-1/2 left-20 bg-white/80 px-2 py-1 rounded text-xs font-bold">Maple Tree</div>}
      </div>

      {/* Human */}
      <div 
        className="absolute left-1/3 bottom-20 cursor-pointer transition-transform hover:scale-105 z-10"
        onClick={() => setSelectedSampleId('muscle')}
      >
        <div className="relative group">
            {/* Simple Human SVG Shape */}
            <svg width="100" height="200" viewBox="0 0 100 200" className="drop-shadow-lg">
                <circle cx="50" cy="30" r="20" fill="#fca5a5" />
                <rect x="30" y="50" width="40" height="70" rx="10" fill="#60a5fa" /> {/* Shirt */}
                <rect x="30" y="120" width="18" height="70" rx="5" fill="#1e3a8a" /> {/* Leg L */}
                <rect x="52" y="120" width="18" height="70" rx="5" fill="#1e3a8a" /> {/* Leg R */}
                <rect x="10" y="55" width="15" height="60" rx="5" fill="#fca5a5" transform="rotate(10 10 55)" /> {/* Arm L */}
                <rect x="80" y="55" width="15" height="50" rx="5" fill="#fca5a5" transform="rotate(-20 80 55)" /> {/* Arm R holding book */}
            </svg>
            {showLabels && <div className="absolute -top-8 left-0 bg-white/80 px-2 py-1 rounded text-xs font-bold">Human</div>}
        </div>
      </div>

      {/* Cow */}
      <div 
        className="absolute right-1/4 bottom-32 cursor-pointer transition-transform hover:scale-105 z-0"
        onClick={() => setSelectedSampleId('cow')}
      >
         <svg width="120" height="80" viewBox="0 0 120 80" className="drop-shadow-md">
            <rect x="20" y="20" width="80" height="40" rx="10" fill="white" />
            <circle cx="30" cy="30" r="5" fill="black" />
            <circle cx="70" cy="40" r="8" fill="black" />
            <rect x="25" y="60" width="10" height="20" fill="white" />
            <rect x="85" y="60" width="10" height="20" fill="white" />
            <circle cx="15" cy="30" r="12" fill="white" /> {/* Head */}
         </svg>
         {showLabels && <div className="absolute -top-6 left-0 bg-white/80 px-2 py-1 rounded text-xs font-bold">Cow</div>}
      </div>

      {/* Frog */}
      <div 
        className="absolute right-20 bottom-10 cursor-pointer transition-transform hover:scale-110 z-10"
        onClick={() => setSelectedSampleId('frog')}
      >
        <div className="w-12 h-8 bg-green-500 rounded-full relative shadow-sm">
            <div className="absolute -top-2 left-1 w-3 h-3 bg-green-500 rounded-full"></div>
            <div className="absolute -top-2 right-1 w-3 h-3 bg-green-500 rounded-full"></div>
        </div>
        {showLabels && <div className="absolute -top-8 left-0 bg-white/80 px-2 py-1 rounded text-xs font-bold">Frog</div>}
      </div>

      {/* Rock */}
      <div 
        className="absolute left-10 bottom-5 cursor-pointer transition-transform hover:scale-105 z-10"
        onClick={() => setSelectedSampleId('rock')}
      >
        <div className="w-20 h-12 bg-stone-500 rounded-[40%_60%_30%_70%] shadow-inner border-b-4 border-stone-700"></div>
        {showLabels && <div className="absolute -top-8 left-0 bg-white/80 px-2 py-1 rounded text-xs font-bold">Rock</div>}
      </div>
      
      {/* Selection Indicator */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur px-6 py-2 rounded-full shadow-lg text-slate-700 font-medium text-sm pointer-events-none">
         {selectedSampleId === 'none' ? 'Click an organism to collect a sample' : `Sample Collected: ${currentSample.name}`}
      </div>
    </div>
  );

  const renderMicroscope = () => {
    // Calculate Blur: 0 is perfect focus (50). 
    const blurAmount = Math.abs(focusLevel - 50) * 0.4;
    // Calculate Scale: 
    const scale = magnification / 40;
    // Calculate Position based on stage sliders
    const offsetX = (stageX - 50) * 4;
    const offsetY = (stageY - 50) * 4;

    // Generate pattern based on sample type
    const getSamplePattern = () => {
      if (currentSample.id === 'none') return <div className="w-full h-full bg-white opacity-50" />;
      
      const commonProps = {
        width: "100%", height: "100%", fill: "none"
      };

      switch(currentSample.pattern) {
        case 'muscle': // Striated lines
          return (
            <svg {...commonProps} viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <pattern id="striations" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
                   <line x1="0" y1="0" x2="0" y2="10" stroke="#ec4899" strokeWidth="2" opacity="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="#fecaca" />
              <rect width="100%" height="100%" fill="url(#striations)" />
              {/* Nuclei */}
              <circle cx="20" cy="20" r="3" fill="#831843" opacity="0.6" />
              <circle cx="60" cy="50" r="3" fill="#831843" opacity="0.6" />
              <circle cx="80" cy="10" r="3" fill="#831843" opacity="0.6" />
            </svg>
          );
        case 'plant': // Brick wall like cells
          return (
            <svg {...commonProps} viewBox="0 0 100 100" preserveAspectRatio="none">
               <defs>
                <pattern id="plantcells" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                   <rect x="0" y="0" width="18" height="18" stroke="#15803d" fill="#86efac" strokeWidth="1" />
                   <circle cx="9" cy="9" r="2" fill="#166534" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#plantcells)" />
            </svg>
          );
        case 'blood': // Small circles
          return (
            <svg {...commonProps} viewBox="0 0 100 100">
               <defs>
                <pattern id="bloodcells" x="0" y="0" width="15" height="15" patternUnits="userSpaceOnUse">
                   <circle cx="7" cy="7" r="4" fill="#ef4444" stroke="#991b1b" strokeWidth="0.5" />
                   {/* Nucleated for frog */}
                   <circle cx="7" cy="7" r="1.5" fill="#7f1d1d" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="#fecaca" opacity="0.3" />
              <rect width="100%" height="100%" fill="url(#bloodcells)" />
            </svg>
          );
        case 'mineral': // Jagged mess
            return (
                <svg {...commonProps} viewBox="0 0 100 100" preserveAspectRatio="none">
                  <filter id="noise">
                     <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/>
                  </filter>
                  <rect width="100%" height="100%" filter="url(#noise)" opacity="0.5"/>
                  <path d="M0,0 L100,100 M100,0 L0,100" stroke="#475569" strokeWidth="0.5" />
                </svg>
            );
        default: // Cow skin / generic
             return (
                <svg {...commonProps} viewBox="0 0 100 100">
                   <circle cx="50" cy="50" r="30" fill="#e5e5e5" />
                   <path d="M20,20 Q40,5 60,20 T100,20" stroke="black" fill="none"/>
                </svg>
             );
      }
    };

    return (
      <div className="relative w-full h-full bg-slate-800 flex flex-col items-center justify-center p-4">
        
        {/* Viewport Container */}
        <div className="relative w-[500px] h-[500px] bg-black rounded-full overflow-hidden border-8 border-slate-600 shadow-2xl flex items-center justify-center mb-4">
           
           {/* Viewport Lens Reflection/Overlay */}
           <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-black/40 to-transparent z-20 pointer-events-none"></div>
           
           {/* Sample Rendering Layer */}
           <div 
            className="w-full h-full bg-white flex items-center justify-center transition-all duration-100"
            style={{ 
                filter: `blur(${blurAmount}px)`,
                transform: `scale(${scale}) translate(${offsetX}px, ${offsetY}px)`
            }}
           >
             {getSamplePattern()}
           </div>

           {/* Crosshair overlay */}
           <div className="absolute inset-0 z-10 opacity-30 pointer-events-none flex items-center justify-center">
               <div className="w-full h-[1px] bg-black"></div>
               <div className="h-full w-[1px] bg-black absolute"></div>
           </div>
        </div>

        {/* Controls Dock */}
        <div className="absolute bottom-6 bg-slate-200/90 backdrop-blur p-4 rounded-xl shadow-xl border border-slate-400 flex gap-8 items-start">
           
           {/* Mag */}
           <div className="flex flex-col gap-2">
              <span className="text-xs font-bold uppercase text-slate-500">Magnification</span>
              <div className="flex gap-2">
                {[40, 100, 400].map(m => (
                    <button 
                        key={m}
                        onClick={() => setMagnification(m)}
                        className={`px-3 py-1 rounded text-sm font-bold ${magnification === m ? 'bg-orange-500 text-white shadow-inner' : 'bg-white text-slate-700 border'}`}
                    >
                        {m}x
                    </button>
                ))}
              </div>
           </div>

           {/* Focus */}
           <div className="flex flex-col gap-2 w-48">
              <span className="text-xs font-bold uppercase text-slate-500">Coarse Focus</span>
              <input 
                type="range" min="0" max="100" 
                value={focusLevel} 
                onChange={(e) => setFocusLevel(Number(e.target.value))}
                className="w-full h-2 bg-slate-400 rounded-lg appearance-none cursor-pointer accent-slate-700"
              />
              <span className="text-xs font-bold uppercase text-slate-500 mt-1">Fine Focus</span>
              <input 
                type="range" min="40" max="60" step="0.5"
                value={focusLevel} 
                onChange={(e) => setFocusLevel(Number(e.target.value))}
                className="w-full h-2 bg-slate-400 rounded-lg appearance-none cursor-pointer accent-slate-700"
              />
           </div>

            {/* Stage */}
           <div className="flex flex-col gap-2 w-32">
              <span className="text-xs font-bold uppercase text-slate-500">Stage Pos</span>
              <div className="grid grid-cols-2 gap-2">
                  <input 
                    type="range" min="0" max="100" 
                    title="X Axis"
                    value={stageX} 
                    onChange={(e) => setStageX(Number(e.target.value))}
                    className="h-2 bg-slate-400 rounded-lg appearance-none cursor-pointer accent-slate-700"
                  />
                  <input 
                    type="range" min="0" max="100" 
                    title="Y Axis"
                    value={stageY} 
                    onChange={(e) => setStageY(Number(e.target.value))}
                    className="h-2 bg-slate-400 rounded-lg appearance-none cursor-pointer accent-slate-700"
                  />
              </div>
              <button 
                onClick={() => { setFocusLevel(50); setStageX(50); setStageY(50); }}
                className="text-xs text-blue-600 hover:underline mt-1 text-center"
              >
                Reset View
              </button>
           </div>

        </div>
      </div>
    );
  };

  const renderLab = () => {
    // Colors
    const COLOR_ATP_NEG = '#e2e8f0'; // Slate 200 (Clear/Grey)
    const COLOR_ATP_POS = '#4ade80'; // Green 400 (Glowing Green)
    
    const COLOR_PH_NEG = '#f472b6'; // Pink 400 (Phenol Red - Neutral/Basic)
    const COLOR_PH_POS = '#facc15'; // Yellow 400 (Acidic/Positive Respiration)

    // Logic
    // Progress 0 -> 100. 
    // At 100, final colors apply.
    // During 0-99, interpolate or just wait.
    
    // Positive Control: Always turns Positive
    // Negative Control: Always stays Negative
    // Sample: Turns Positive if isAlive

    const getFinalColor = (testType, controlType) => {
       if (testType === 'atp') {
         if (controlType === 'pos') return COLOR_ATP_POS;
         if (controlType === 'neg') return COLOR_ATP_NEG;
         // Sample
         return currentSample.isAlive ? COLOR_ATP_POS : COLOR_ATP_NEG;
       } else {
         // Phenol Red
         if (controlType === 'pos') return COLOR_PH_POS;
         if (controlType === 'neg') return COLOR_PH_NEG;
         // Sample
         return currentSample.isAlive ? COLOR_PH_POS : COLOR_PH_NEG;
       }
    };

    const getInitialColor = (testType) => {
        return testType === 'atp' ? COLOR_ATP_NEG : COLOR_PH_NEG;
    };

    // Component for a single well
    const Well = ({ label, testType, controlType }) => {
        const initial = getInitialColor(testType);
        const final = getFinalColor(testType, controlType);
        
        // Interpolate simple logic: if running, fade to final. If not run, initial.
        const displayedColor = hasRunTest ? final : initial;
        
        // Glow effect if positive and finished
        const isGlowing = hasRunTest && displayedColor === (testType === 'atp' ? COLOR_ATP_POS : COLOR_PH_POS);

        return (
            <div className="flex flex-col items-center gap-2">
                <div className={`relative w-24 h-24 rounded-full border-4 border-slate-300 shadow-inner overflow-hidden flex items-center justify-center transition-colors duration-[2000ms] ease-in-out ${isGlowing ? 'ring-4 ring-green-200 shadow-[0_0_20px_rgba(74,222,128,0.6)]' : ''}`}
                     style={{ backgroundColor: displayedColor }}
                >
                    {/* Liquid Reflection */}
                    <div className="absolute top-2 left-4 w-8 h-4 bg-white opacity-20 rounded-full -rotate-12" />
                    <div className="absolute bottom-2 right-4 w-12 h-12 bg-black opacity-5 rounded-full blur-lg" />
                </div>
                <span className="text-sm font-semibold text-slate-600">{label}</span>
            </div>
        );
    };

    return (
      <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center p-8">
        
        {/* Incubator Controls */}
        <div className="absolute top-8 left-8 bg-white p-4 rounded-lg shadow border border-slate-200 flex flex-col items-center gap-4">
             <div className="text-slate-500 font-bold uppercase text-xs tracking-wider">Incubator Power</div>
             <button 
                onClick={() => !hasRunTest && setIsIncubatorOn(!isIncubatorOn)}
                disabled={hasRunTest}
                className={`w-16 h-24 rounded-lg border-2 shadow-inner flex flex-col items-center justify-center gap-2 transition-all ${isIncubatorOn ? 'bg-green-100 border-green-500' : 'bg-slate-50 border-slate-300'}`}
             >
                <div className={`w-2 h-2 rounded-full ${isIncubatorOn ? 'bg-green-500 shadow-[0_0_5px_#22c55e]' : 'bg-slate-300'}`}></div>
                <div className={`w-6 h-12 rounded border bg-white shadow-sm flex items-center justify-center transition-transform ${isIncubatorOn ? '-translate-y-1' : 'translate-y-1'}`}>
                    <div className="w-4 h-1 bg-slate-300"></div>
                </div>
                <span className="text-xs font-bold text-slate-500">{isIncubatorOn ? 'ON' : 'OFF'}</span>
             </button>
             
             {hasRunTest && (
                <button onClick={() => {setHasRunTest(false); setIsIncubatorOn(false); setTestProgress(0);}} className="text-blue-500 text-xs hover:underline flex items-center gap-1">
                    <RotateCcw size={12} /> Reset Test
                </button>
             )}
        </div>

        {/* Plate Container */}
        <div className="bg-white/50 backdrop-blur-sm p-8 rounded-3xl shadow-2xl border border-white/50 relative">
            {/* Plate Glass Effect */}
            <div className="absolute inset-0 rounded-3xl border border-white/60 pointer-events-none"></div>
            
            <h2 className="text-2xl font-bold text-slate-700 mb-8 text-center border-b border-slate-300 pb-4">
                Metabolic Activity Test Plate
            </h2>
            
            <div className="grid grid-cols-[120px_1fr] gap-y-12 gap-x-8 items-center">
                {/* Row 1 Label */}
                <div className="text-right">
                    <div className="font-bold text-slate-800">ATP Test</div>
                    <div className="text-xs text-slate-500">(Energy)</div>
                </div>
                {/* Row 1 Wells */}
                <div className="flex gap-8">
                    <Well label="Positive Ctrl" testType="atp" controlType="pos" />
                    <Well label="Negative Ctrl" testType="atp" controlType="neg" />
                    <Well label="My Sample" testType="atp" controlType="sample" />
                </div>

                 {/* Row 2 Label */}
                 <div className="text-right">
                    <div className="font-bold text-slate-800">Phenol Red</div>
                    <div className="text-xs text-slate-500">(Respiration/Acid)</div>
                </div>
                {/* Row 2 Wells */}
                <div className="flex gap-8">
                    <Well label="Positive Ctrl" testType="ph" controlType="pos" />
                    <Well label="Negative Ctrl" testType="ph" controlType="neg" />
                    <Well label="My Sample" testType="ph" controlType="sample" />
                </div>
            </div>

            {currentSample.id === 'none' && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-3xl">
                    <div className="bg-red-100 text-red-800 px-6 py-4 rounded-lg shadow-lg border border-red-200 font-bold">
                        ⚠ Please select a sample in Landscape mode first.
                    </div>
                </div>
            )}
        </div>
        
      </div>
    );
  };

  // --- Main Layout ---

  return (
    <div className="flex flex-col w-full h-screen bg-slate-100 font-sans text-slate-900 overflow-hidden">
      {/* Header */}
      <header className="h-14 bg-gradient-to-b from-slate-200 to-slate-300 border-b border-slate-400 flex items-center justify-between px-4 shadow-sm z-20">
         <div className="flex items-center gap-2 font-bold text-slate-700">
            <FlaskConical className="text-orange-600" />
            <span>BioLab: Cell & Life Simulation</span>
         </div>
         
         {/* Tabs */}
         <div className="flex h-full items-end gap-1">
            {[
                { id: 'landscape', label: 'LANDSCAPE', icon: Search },
                { id: 'microscope', label: 'MICROSCOPE', icon: Microscope },
                { id: 'lab', label: 'TEST FOR LIFE', icon: FlaskConical },
            ].map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                        flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-t-lg transition-all
                        ${activeTab === tab.id 
                            ? 'bg-white text-slate-800 shadow-[0_-2px_5px_rgba(0,0,0,0.05)] relative top-[1px] border-t border-x border-white z-10' 
                            : 'bg-slate-300/50 text-slate-500 hover:bg-slate-200 hover:text-slate-700 inset-shadow'}
                    `}
                >
                    {/* <tab.icon size={16} /> */}
                    {tab.label}
                </button>
            ))}
         </div>

         <div className="w-32"></div> {/* Spacer for balance */}
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative">
         
         {/* Left: Simulation Viewport */}
         <div className="flex-1 bg-white relative overflow-hidden shadow-inner">
            {activeTab === 'landscape' && renderLandscape()}
            {activeTab === 'microscope' && renderMicroscope()}
            {activeTab === 'lab' && renderLab()}
         </div>

         {/* Right: Sidebar */}
         {renderSidebar()}

      </div>
    </div>
  );
};

export default BiologyLabSim;