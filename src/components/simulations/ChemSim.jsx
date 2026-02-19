import React, { useState, useEffect } from 'react';
import { Play, RotateCcw, Pause, Droplet, Thermometer, FlaskConical, Info } from 'lucide-react';

// --- DATA DEFINITIONS ---

// Exact dropdown options from your screenshot
const REACTANT_1_OPTIONS = [
    { id: 'NA', name: 'Sodium', type: 'solid' },
    { id: 'H2O2', name: 'Hydrogen peroxide', type: 'liquid' },
    { id: 'AGNO3', name: 'Silver nitrate', type: 'liquid' },
    { id: 'CACL2', name: 'Calcium chloride', type: 'solid' },
    { id: 'NH4NO3', name: 'Ammonium nitrate', type: 'solid' }
];

const REACTANT_2_OPTIONS = [
    { id: 'H2O', name: 'Water' },
    { id: 'KI_SOAP', name: 'Potassium iodide and dish soap' },
    { id: 'NACL', name: 'Sodium chloride' }
];

// Physics/Chemistry Logic for each pair
const REACTIONS = {
    // 1. Sodium + Water -> H2 + NaOH + Heat (Exothermic, Basic)
    'NA_H2O': {
        equation: '2Na (s) + 2H₂O (l) → 2NaOH (aq) + H₂ (g)',
        description: 'Sodium reacts violently with water, producing hydrogen gas and heat.',
        isChemicalChange: true,
        finalTemp: 50,      // Hot
        finalPH: 12,        // Basic (Purple/Pink with Phenol Red)
        gasProduced: true,
        precipitate: false,
        colorChange: 'purple', // Phenol red turns purple
        massChange: -0.5,   // H2 gas escapes
        visualType: 'fizzing'
    },
    // 2. Elephant Toothpaste (H2O2 + KI) -> Exothermic, Foam
    'H2O2_KI_SOAP': {
        equation: '2H₂O₂ (aq) → 2H₂O (l) + O₂ (g) + Heat',
        description: 'Catalytic decomposition of hydrogen peroxide creates oxygen foam.',
        isChemicalChange: true,
        finalTemp: 60,      // Very Hot
        finalPH: 7,         // Neutral
        gasProduced: true,
        precipitate: false,
        colorChange: 'green', // Foam color
        massChange: -1.2,   // O2 gas escapes (significant)
        visualType: 'foam'
    },
    // 3. Silver Nitrate + NaCl -> Precipitate
    'AGNO3_NACL': {
        equation: 'AgNO₃ (aq) + NaCl (aq) → AgCl (s) + NaNO₃ (aq)',
        description: 'Double displacement reaction forming a white solid precipitate.',
        isChemicalChange: true,
        finalTemp: 22,      // Slight/No change
        finalPH: 7,
        gasProduced: false,
        precipitate: true,
        colorChange: 'white', // White solid
        massChange: 0,      // Closed system mostly
        visualType: 'precipitate'
    },
    // 4. Calcium Chloride + Water -> Exothermic (Hot pack)
    'CACL2_H2O': {
        equation: 'CaCl₂ (s) + H₂O (l) → Ca²⁺ (aq) + 2Cl⁻ (aq) + Heat',
        description: 'Dissolving calcium chloride releases significant heat (Exothermic).',
        isChemicalChange: true, // Physical/Chemical gray area, often taught as chemical change in heat context
        finalTemp: 45,      // Hot
        finalPH: 7,
        gasProduced: false,
        precipitate: false,
        colorChange: 'none',
        massChange: 0,
        visualType: 'dissolve'
    },
    // 5. Ammonium Nitrate + Water -> Endothermic (Cold pack)
    'NH4NO3_H2O': {
        equation: 'NH₄NO₃ (s) + H₂O (l) → NH₄⁺ (aq) + NO₃⁻ (aq) - Heat',
        description: 'Dissolving ammonium nitrate absorbs heat (Endothermic).',
        isChemicalChange: true,
        finalTemp: 5,       // Cold!
        finalPH: 7,
        gasProduced: false,
        precipitate: false,
        colorChange: 'none',
        massChange: 0,
        visualType: 'dissolve'
    }
};

const DEFAULT_REACTION = {
    equation: 'Mixture',
    description: 'No observable chemical reaction occurred.',
    isChemicalChange: false,
    finalTemp: 21,
    finalPH: 7,
    gasProduced: false,
    precipitate: false,
    massChange: 0,
    visualType: 'none'
};

const INITIAL_MASS = 341.6; // Matches your screenshot
const INITIAL_TEMP = 21.0;

const App = () => {
    // State
    const [r1, setR1] = useState('H2O2');
    const [r2, setR2] = useState('KI_SOAP');
    const [setup, setSetup] = useState('normal'); // normal, closed
    const [showLabels, setShowLabels] = useState(false);
    const [showEquation, setShowEquation] = useState(false);
    
    const [progress, setProgress] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [activeTool, setActiveTool] = useState(null); // 'thermometer', 'phenol'

    // Simulation Values
    const [currentTemp, setCurrentTemp] = useState(INITIAL_TEMP);
    const [currentMass, setCurrentMass] = useState(INITIAL_MASS);
    const [currentPHColor, setCurrentPHColor] = useState('bg-orange-100'); // Neutral/starting color

    // Determine current active reaction
    const reactionKey = `${r1}_${r2}`;
    const reaction = REACTIONS[reactionKey] || DEFAULT_REACTION;

    // --- ANIMATION LOOP ---
    useEffect(() => {
        let interval;
        if (isPlaying && progress < 100) {
            interval = setInterval(() => {
                setProgress(prev => {
                    const next = prev + 1;
                    
                    // Interpolate Values based on progress
                    const ratio = next / 100;
                    
                    // Temp
                    const tempDiff = reaction.finalTemp - INITIAL_TEMP;
                    setCurrentTemp(INITIAL_TEMP + (tempDiff * ratio));

                    // Mass (Only changes if NOT closed system)
                    if (setup === 'normal') {
                        setCurrentMass(INITIAL_MASS + (reaction.massChange * ratio));
                    }

                    // Stop at 100
                    if (next >= 100) setIsPlaying(false);
                    return next;
                });
            }, 40); // Speed of animation
        }
        return () => clearInterval(interval);
    }, [isPlaying, progress, reaction, setup]);

    // --- HANDLERS ---
    const handlePlay = () => {
        if (progress < 100) setIsPlaying(true);
    };
    
    const handleReset = () => {
        setIsPlaying(false);
        setProgress(0);
        setCurrentTemp(INITIAL_TEMP);
        setCurrentMass(INITIAL_MASS);
        setCurrentPHColor('bg-orange-100');
        setActiveTool(null);
    };

    const handleToolClick = (tool) => {
        if (activeTool === tool) setActiveTool(null);
        else setActiveTool(tool);
    };

    // Determine visual state of the flask
    const getFlaskContent = () => {
        // Base liquid
        let content = <div className="absolute bottom-0 w-full h-1/3 bg-blue-100 opacity-50 transition-all duration-1000"></div>;

        // Phenol Red Effect (If tool active or reaction causes color change)
        const isPhenolActive = activeTool === 'phenol';
        
        // Dynamic Color Calculation
        let colorClass = 'bg-blue-100';
        if (isPhenolActive || progress > 0) {
             if (reaction.finalPH > 10 && progress > 20) colorClass = 'bg-purple-500'; // Basic
             else if (reaction.visualType === 'foam') colorClass = 'bg-green-200'; 
             else if (isPhenolActive) colorClass = 'bg-orange-300'; // Phenol neutral
        }

        // Visual Effects based on type
        if (reaction.visualType === 'foam') {
            const foamHeight = (progress / 100) * 80; // Up to 80% height
            return (
                <>
                    <div className={`absolute bottom-0 w-full transition-all duration-100 ${colorClass} opacity-90`} style={{ height: `${20 + foamHeight}%`, borderRadius: '0 0 8px 8px' }}>
                        {/* Bubbles */}
                        <div className="w-full h-full animate-pulse opacity-50 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
                    </div>
                    {progress > 50 && <div className="absolute -top-10 left-0 w-full h-20 bg-green-100 rounded-full blur-xl opacity-50 animate-pulse"></div>}
                </>
            );
        }
        
        if (reaction.visualType === 'fizzing') {
             return (
                <div className={`absolute bottom-0 w-full h-1/3 transition-colors duration-1000 ${colorClass}`} style={{ borderRadius: '0 0 8px 8px' }}>
                    {isPlaying && (
                        <div className="absolute inset-0 flex justify-center items-end pb-2 space-x-1">
                            <div className="w-2 h-2 bg-white rounded-full animate-bounce delay-75"></div>
                            <div className="w-3 h-3 bg-white rounded-full animate-bounce delay-150"></div>
                            <div className="w-2 h-2 bg-white rounded-full animate-bounce delay-300"></div>
                        </div>
                    )}
                </div>
             );
        }

        if (reaction.visualType === 'precipitate') {
            return (
                <div className="absolute bottom-0 w-full h-1/3 bg-blue-50">
                    <div className={`absolute bottom-0 w-full transition-all duration-1000 bg-white opacity-90`} style={{ height: `${(progress/100) * 20}%` }}></div>
                </div>
            );
        }

        // Default liquid
        return <div className={`absolute bottom-0 w-full h-1/3 ${colorClass} transition-colors duration-1000`} style={{ borderRadius: '0 0 8px 8px' }}></div>;
    };


    return (
        <div className="flex flex-col w-full h-screen bg-white font-sans text-slate-800 select-none">
            {/* Header */}
            <header className="h-14 border-b flex items-center px-6 bg-white shadow-sm z-10">
                <div className="flex items-center gap-2">
                     <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-cyan-300 rounded-md shadow-sm border border-blue-500"></div>
                     <h1 className="font-bold text-xl text-slate-800">Chemical Changes</h1>
                </div>
                <div className="ml-auto text-cyan-600 text-sm font-bold cursor-pointer hover:underline">Go to Lesson Info</div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                
                {/* --- LEFT SIDEBAR --- */}
                <div className="w-72 bg-white border-r border-slate-200 p-4 flex flex-col gap-6 shadow-[2px_0_5px_rgba(0,0,0,0.05)] z-10">
                    
                    {/* Reactant 1 */}
                    <div className="flex flex-col gap-1">
                        <label className="font-bold text-sm text-slate-900">Reactant 1</label>
                        <div className="relative">
                            <select 
                                className="w-full border border-slate-400 rounded shadow-sm p-2 text-sm bg-gradient-to-b from-white to-slate-50 focus:ring-2 focus:ring-blue-400 outline-none"
                                value={r1}
                                onChange={(e) => { setR1(e.target.value); handleReset(); }}
                                disabled={isPlaying || progress > 0}
                            >
                                {REACTANT_1_OPTIONS.map(opt => (
                                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Reactant 2 */}
                    <div className="flex flex-col gap-1">
                        <label className="font-bold text-sm text-slate-900">Reactant 2</label>
                        <div className="relative">
                            <select 
                                className="w-full border border-slate-400 rounded shadow-sm p-2 text-sm bg-gradient-to-b from-white to-slate-50 focus:ring-2 focus:ring-blue-400 outline-none"
                                value={r2}
                                onChange={(e) => { setR2(e.target.value); handleReset(); }}
                                disabled={isPlaying || progress > 0}
                            >
                                {REACTANT_2_OPTIONS.map(opt => (
                                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Experimental Setup */}
                    <div>
                        <label className="font-bold text-sm text-slate-900 mb-2 block">Experimental setup</label>
                        <div className="flex flex-col gap-2 ml-1">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="setup" 
                                    checked={setup === 'normal'} 
                                    onChange={() => setSetup('normal')}
                                    className="w-4 h-4 accent-slate-600"
                                />
                                <span className="text-sm text-slate-600">Normal setup</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="setup" 
                                    checked={setup === 'closed'} 
                                    onChange={() => setSetup('closed')}
                                    className="w-4 h-4 accent-slate-600"
                                />
                                <span className="text-sm text-slate-600">Closed system</span>
                            </label>
                        </div>
                    </div>

                    {/* Options */}
                    <div>
                        <label className="font-bold text-sm text-slate-900 mb-2 block">Options</label>
                        <div className="flex flex-col gap-2 ml-1">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={showLabels}
                                    onChange={(e) => setShowLabels(e.target.checked)}
                                    className="w-5 h-5 rounded border-slate-400"
                                />
                                <span className="text-sm text-slate-600">Label reactants</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={showEquation}
                                    onChange={(e) => setShowEquation(e.target.checked)}
                                    className="w-5 h-5 rounded border-slate-400"
                                />
                                <span className="text-sm text-slate-600">Show chemical equation</span>
                            </label>
                        </div>
                    </div>

                    {showEquation && (
                        <div className="mt-auto p-3 bg-blue-50 border border-blue-200 rounded text-xs text-slate-700 font-mono">
                            <strong>Equation:</strong><br/>
                            {reaction.equation}
                        </div>
                    )}
                </div>

                {/* --- MAIN CANVAS --- */}
                <div className="flex-1 relative bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col items-center justify-center overflow-hidden">
                    
                    {/* Background grid hints */}
                    <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '100px 100px' }}></div>

                    {/* --- Apparatus Layer --- */}
                    <div className="relative w-[600px] h-[400px] flex items-end justify-center pb-20">
                        
                        {/* Reactant 2 (Dropper/Beaker) - Animated */}
                        <div 
                            className={`absolute transition-all duration-1000 z-20 ${isPlaying ? 'top-20 opacity-0' : 'top-10 opacity-100'}`}
                            style={{ left: '55%' }}
                        >
                             {/* Glass Beaker Graphic */}
                             <div className="w-16 h-20 bg-white/30 border-2 border-slate-300 rounded-b-lg relative shadow-sm backdrop-blur-[1px]">
                                 <div className="absolute bottom-0 w-full h-1/2 bg-blue-100 opacity-50 rounded-b-md"></div>
                             </div>
                             {showLabels && <div className="absolute -top-6 -left-4 w-32 text-center text-xs bg-white/80 px-1 rounded border border-slate-300">Reactant 2</div>}
                        </div>

                        {/* Reactant 1 (Dropper) */}
                        <div className={`absolute top-40 left-[48%] z-20 transition-all duration-500 ${isPlaying ? 'translate-y-10 rotate-45' : ''}`}>
                            {/* Simple Dropper Graphic */}
                            <div className="w-8 h-20 bg-slate-100 border border-slate-400 rounded-full shadow-lg flex flex-col items-center">
                                <div className="w-4 h-6 bg-slate-800 rounded-t-full mt-[-5px]"></div>
                                <div className="w-1 h-full bg-slate-200/50"></div>
                            </div>
                             {showLabels && <div className="absolute top-10 -left-20 text-xs bg-white/80 px-1 rounded border border-slate-300">Reactant 1</div>}
                        </div>


                        {/* SCALE & FLASK */}
                        <div className="relative flex flex-col items-center">
                            
                            {/* Flask */}
                            <div className="relative mb-[-5px] z-10">
                                {/* Flask Body */}
                                <div className="w-32 h-40 bg-white/20 border-4 border-slate-300/80 rounded-[40%_40%_10%_10%] relative overflow-hidden backdrop-blur-sm shadow-inner">
                                    {/* Content Liquid/Gas */}
                                    {getFlaskContent()}
                                    
                                    {/* Thermometer inside if active */}
                                    {activeTool === 'thermometer' && (
                                        <div className="absolute top-[-20px] left-1/2 -translate-x-1/2 h-full w-2 bg-red-100 border border-red-300 shadow-sm">
                                            <div className="absolute bottom-0 w-full bg-red-500 transition-all duration-500" style={{ height: `${(currentTemp / 100) * 100}%` }}></div>
                                        </div>
                                    )}
                                </div>
                                {/* Flask Neck */}
                                <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-10 h-20 bg-white/20 border-x-4 border-slate-300/80"></div>
                                <div className="absolute -top-[68px] left-1/2 -translate-x-1/2 w-14 h-4 bg-slate-300/80 rounded-full"></div>
                                
                                {/* Closed System Stopper */}
                                {setup === 'closed' && (
                                    <div className="absolute -top-[60px] left-1/2 -translate-x-1/2 w-10 h-8 bg-amber-800 rounded-t-md shadow-inner"></div>
                                )}
                            </div>

                            {/* Digital Scale */}
                            <div className="w-96 h-16 bg-slate-800 rounded-lg shadow-2xl border-b-8 border-slate-900 flex items-center justify-center relative">
                                {/* Display Screen */}
                                <div className="bg-slate-100 border-4 border-slate-300 rounded px-6 py-2 font-mono text-2xl font-bold text-slate-800 shadow-inner">
                                    {currentMass.toFixed(1)} g
                                </div>
                                {/* Power Light */}
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 w-3 h-3 bg-red-500 rounded-full shadow-[0_0_5px_rgba(239,68,68,0.8)]"></div>
                            </div>
                        </div>
                    </div>


                    {/* --- BOTTOM TOOLBAR & CONTROLS --- */}
                    <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-slate-300 to-slate-200 border-t border-slate-300 flex items-center px-8">
                        
                        {/* Tools Container */}
                        <div className="flex gap-4 mr-auto">
                            {/* Thermometer Tool */}
                            <div 
                                onClick={() => handleToolClick('thermometer')}
                                className={`w-28 h-24 bg-white rounded border shadow-sm flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-105 ${activeTool === 'thermometer' ? 'ring-2 ring-blue-400' : 'border-slate-300'}`}
                            >
                                <div className="text-xs font-bold text-slate-500 mb-2">Thermometer</div>
                                <div className="relative h-12 w-2 bg-slate-200 rounded-full border border-slate-300">
                                     <div className="absolute bottom-0 w-full bg-red-500 rounded-full h-3/4"></div>
                                </div>
                                <div className="mt-1 text-xs font-mono">{activeTool === 'thermometer' ? `${currentTemp.toFixed(0)} °C` : 'Start: 21 °C'}</div>
                            </div>

                            {/* Phenol Red Tool */}
                            <div 
                                onClick={() => handleToolClick('phenol')}
                                className={`w-28 h-24 bg-white rounded border shadow-sm flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-105 ${activeTool === 'phenol' ? 'ring-2 ring-blue-400' : 'border-slate-300'}`}
                            >
                                <div className="text-xs font-bold text-slate-500 mb-2">Phenol red</div>
                                <div className="h-10 w-8 bg-orange-100 border border-slate-300 rounded-b-md relative overflow-hidden">
                                     <div className="absolute bottom-0 w-full h-2/3 bg-orange-300 opacity-60"></div>
                                </div>
                                <div className="mt-1 text-xs font-mono">{activeTool === 'phenol' ? 'Active' : 'Start: Neutral'}</div>
                            </div>
                        </div>

                        {/* Playback Controls */}
                        <div className="flex items-center gap-2 ml-auto bg-slate-200 p-1 rounded-lg border border-slate-300 shadow-inner">
                             <div className="text-sm font-bold text-slate-600 mr-2 px-2">Controls:</div>
                             <button 
                                onClick={handlePlay}
                                disabled={isPlaying || progress === 100}
                                className="w-10 h-10 bg-white rounded shadow-sm flex items-center justify-center hover:bg-blue-50 disabled:opacity-50 border border-slate-300"
                            >
                                <Play size={18} className="text-slate-700 fill-slate-700"/>
                             </button>
                             <button 
                                onClick={() => setIsPlaying(false)}
                                disabled={!isPlaying}
                                className="w-10 h-10 bg-white rounded shadow-sm flex items-center justify-center hover:bg-blue-50 disabled:opacity-50 border border-slate-300"
                            >
                                <Pause size={18} className="text-slate-700 fill-slate-700"/>
                             </button>
                             <button 
                                onClick={handleReset}
                                className="w-10 h-10 bg-white rounded shadow-sm flex items-center justify-center hover:bg-blue-50 border border-slate-300"
                            >
                                <RotateCcw size={18} className="text-slate-700"/>
                             </button>
                        </div>

                    </div>

                </div>
            </div>
        </div>
    );
};

export default App;