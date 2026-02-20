"use client"

import { useRunner } from "react-runner"
import React, { useEffect, useRef, useMemo } from "react"
import { Play, Pause, RotateCcw, Settings, AlertCircle, Sparkles, Plus, Minus, ArrowRight, ArrowLeft, ArrowUp, ArrowDown, RefreshCw, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Info, HelpCircle, Check, X, Zap, Thermometer, Droplets, Wind, Sun, Moon, Atom, FlaskConical, Ruler, Timer, Eye, EyeOff, Volume2, VolumeX } from "lucide-react"
import { 
  LineChart, BarChart, AreaChart, ScatterChart,
  Line, Bar, Area, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts"
import { Button } from "./ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card"
import { Input } from "./ui/input"
import { Label } from "./ui/label"

// Common science data that AI-generated simulations may reference
const ELEMENTS = [
  { symbol: "H", name: "Hydrogen", number: 1, mass: 1.008, category: "nonmetal", color: "#FFFFFF", electronConfig: "1s1", electronegativity: 2.20, radius: 53 },
  { symbol: "He", name: "Helium", number: 2, mass: 4.003, category: "noble gas", color: "#D9FFFF", electronConfig: "1s2", electronegativity: 0, radius: 31 },
  { symbol: "Li", name: "Lithium", number: 3, mass: 6.941, category: "alkali metal", color: "#CC80FF", electronConfig: "[He]2s1", electronegativity: 0.98, radius: 167 },
  { symbol: "Be", name: "Beryllium", number: 4, mass: 9.012, category: "alkaline earth", color: "#C2FF00", electronConfig: "[He]2s2", electronegativity: 1.57, radius: 112 },
  { symbol: "B", name: "Boron", number: 5, mass: 10.81, category: "metalloid", color: "#FFB5B5", electronConfig: "[He]2s2 2p1", electronegativity: 2.04, radius: 87 },
  { symbol: "C", name: "Carbon", number: 6, mass: 12.011, category: "nonmetal", color: "#909090", electronConfig: "[He]2s2 2p2", electronegativity: 2.55, radius: 77 },
  { symbol: "N", name: "Nitrogen", number: 7, mass: 14.007, category: "nonmetal", color: "#3050F8", electronConfig: "[He]2s2 2p3", electronegativity: 3.04, radius: 75 },
  { symbol: "O", name: "Oxygen", number: 8, mass: 15.999, category: "nonmetal", color: "#FF0D0D", electronConfig: "[He]2s2 2p4", electronegativity: 3.44, radius: 73 },
  { symbol: "F", name: "Fluorine", number: 9, mass: 18.998, category: "halogen", color: "#90E050", electronConfig: "[He]2s2 2p5", electronegativity: 3.98, radius: 71 },
  { symbol: "Ne", name: "Neon", number: 10, mass: 20.180, category: "noble gas", color: "#B3E3F5", electronConfig: "[He]2s2 2p6", electronegativity: 0, radius: 38 },
  { symbol: "Na", name: "Sodium", number: 11, mass: 22.990, category: "alkali metal", color: "#AB5CF2", electronConfig: "[Ne]3s1", electronegativity: 0.93, radius: 190 },
  { symbol: "Mg", name: "Magnesium", number: 12, mass: 24.305, category: "alkaline earth", color: "#8AFF00", electronConfig: "[Ne]3s2", electronegativity: 1.31, radius: 145 },
  { symbol: "Al", name: "Aluminum", number: 13, mass: 26.982, category: "post-transition", color: "#BFA6A6", electronConfig: "[Ne]3s2 3p1", electronegativity: 1.61, radius: 118 },
  { symbol: "Si", name: "Silicon", number: 14, mass: 28.086, category: "metalloid", color: "#F0C8A0", electronConfig: "[Ne]3s2 3p2", electronegativity: 1.90, radius: 111 },
  { symbol: "P", name: "Phosphorus", number: 15, mass: 30.974, category: "nonmetal", color: "#FF8000", electronConfig: "[Ne]3s2 3p3", electronegativity: 2.19, radius: 106 },
  { symbol: "S", name: "Sulfur", number: 16, mass: 32.065, category: "nonmetal", color: "#FFFF30", electronConfig: "[Ne]3s2 3p4", electronegativity: 2.58, radius: 102 },
  { symbol: "Cl", name: "Chlorine", number: 17, mass: 35.453, category: "halogen", color: "#1FF01F", electronConfig: "[Ne]3s2 3p5", electronegativity: 3.16, radius: 99 },
  { symbol: "Ar", name: "Argon", number: 18, mass: 39.948, category: "noble gas", color: "#80D1E3", electronConfig: "[Ne]3s2 3p6", electronegativity: 0, radius: 71 },
  { symbol: "K", name: "Potassium", number: 19, mass: 39.098, category: "alkali metal", color: "#8F40D4", electronConfig: "[Ar]4s1", electronegativity: 0.82, radius: 243 },
  { symbol: "Ca", name: "Calcium", number: 20, mass: 40.078, category: "alkaline earth", color: "#3DFF00", electronConfig: "[Ar]4s2", electronegativity: 1.00, radius: 194 },
  { symbol: "Fe", name: "Iron", number: 26, mass: 55.845, category: "transition metal", color: "#E06633", electronConfig: "[Ar]3d6 4s2", electronegativity: 1.83, radius: 156 },
  { symbol: "Cu", name: "Copper", number: 29, mass: 63.546, category: "transition metal", color: "#C88033", electronConfig: "[Ar]3d10 4s1", electronegativity: 1.90, radius: 140 },
  { symbol: "Zn", name: "Zinc", number: 30, mass: 65.38, category: "transition metal", color: "#7D80B0", electronConfig: "[Ar]3d10 4s2", electronegativity: 1.65, radius: 139 },
  { symbol: "Br", name: "Bromine", number: 35, mass: 79.904, category: "halogen", color: "#A62929", electronConfig: "[Ar]3d10 4s2 4p5", electronegativity: 2.96, radius: 114 },
  { symbol: "Ag", name: "Silver", number: 47, mass: 107.868, category: "transition metal", color: "#C0C0C0", electronConfig: "[Kr]4d10 5s1", electronegativity: 1.93, radius: 165 },
  { symbol: "I", name: "Iodine", number: 53, mass: 126.904, category: "halogen", color: "#940094", electronConfig: "[Kr]4d10 5s2 5p5", electronegativity: 2.66, radius: 133 },
  { symbol: "Au", name: "Gold", number: 79, mass: 196.967, category: "transition metal", color: "#FFD123", electronConfig: "[Xe]4f14 5d10 6s1", electronegativity: 2.54, radius: 174 },
]

const PHYSICS_CONSTANTS = {
  g: 9.81, G: 6.674e-11, c: 299792458, h: 6.626e-34, k: 1.381e-23,
  e: 1.602e-19, me: 9.109e-31, mp: 1.673e-27, Na: 6.022e23, R: 8.314,
  epsilon0: 8.854e-12, mu0: 1.257e-6, sigma: 5.670e-8, pi: Math.PI,
}

const AMINO_ACIDS = [
  { symbol: "A", code: "Ala", name: "Alanine", type: "nonpolar" },
  { symbol: "R", code: "Arg", name: "Arginine", type: "positive" },
  { symbol: "N", code: "Asn", name: "Asparagine", type: "polar" },
  { symbol: "D", code: "Asp", name: "Aspartic acid", type: "negative" },
  { symbol: "C", code: "Cys", name: "Cysteine", type: "polar" },
  { symbol: "E", code: "Glu", name: "Glutamic acid", type: "negative" },
  { symbol: "Q", code: "Gln", name: "Glutamine", type: "polar" },
  { symbol: "G", code: "Gly", name: "Glycine", type: "nonpolar" },
  { symbol: "H", code: "His", name: "Histidine", type: "positive" },
  { symbol: "I", code: "Ile", name: "Isoleucine", type: "nonpolar" },
  { symbol: "L", code: "Leu", name: "Leucine", type: "nonpolar" },
  { symbol: "K", code: "Lys", name: "Lysine", type: "positive" },
  { symbol: "M", code: "Met", name: "Methionine", type: "nonpolar" },
  { symbol: "F", code: "Phe", name: "Phenylalanine", type: "nonpolar" },
  { symbol: "P", code: "Pro", name: "Proline", type: "nonpolar" },
  { symbol: "S", code: "Ser", name: "Serine", type: "polar" },
  { symbol: "T", code: "Thr", name: "Threonine", type: "polar" },
  { symbol: "W", code: "Trp", name: "Tryptophan", type: "nonpolar" },
  { symbol: "Y", code: "Tyr", name: "Tyrosine", type: "polar" },
  { symbol: "V", code: "Val", name: "Valine", type: "nonpolar" },
]

// Simple Slider shim (plain HTML range input)
const Slider = ({ value, onValueChange, min = 0, max = 100, step = 1, className = '', ...props }: any) => {
  const val = Array.isArray(value) ? value[0] : value
  return React.createElement('input', {
    type: 'range',
    min, max, step,
    value: val ?? 0,
    onChange: (e: any) => {
      const v = Number(e.target.value)
      if (onValueChange) onValueChange([v])
    },
    className: 'w-full accent-blue-500 ' + className,
    ...props
  })
}

// motion shim - just renders a normal div/span with style
const motionHandler: ProxyHandler<any> = {
  get(_target, prop) {
    const tag = String(prop)
    return React.forwardRef(({ animate, initial, transition, whileHover, whileTap, variants, ...rest }: any, ref: any) => {
      // Convert framer-motion animate props to inline style
      const style = { ...(rest.style || {}), ...(typeof animate === 'object' ? animate : {}) }
      return React.createElement(tag, { ...rest, ref, style })
    })
  }
}
const motion = new Proxy({}, motionHandler)

// Error boundary to catch infinite re-render loops
class SimulationErrorBoundary extends React.Component<
  { children: React.ReactNode; codeKey: string },
  { hasError: boolean; error: string | null }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  static getDerivedStateFromProps(props: any, state: any) {
    // Reset error when code changes
    if (props.codeKey !== state.prevCodeKey) {
      return { hasError: false, error: null, prevCodeKey: props.codeKey }
    }
    return null
  }
  render() {
    if (this.state.hasError) {
      return React.createElement('div', { className: 'p-4 bg-red-50 text-red-600 rounded-md border border-red-200' },
        React.createElement('h3', { className: 'font-bold mb-2' }, 'Simulation crashed'),
        React.createElement('pre', { className: 'text-xs font-mono whitespace-pre-wrap' }, this.state.error)
      )
    }
    return this.props.children
  }
}

interface Simulation {
  type: string
  reactCode?: string | null
  geogebraFile?: string | null
  geogebraMaterialId?: string | null
  geogebraCommands?: any
  geogebraSettings?: any
}

interface SimulationRunnerProps {
  simulation: Simulation | null
  onError?: (error: string | null) => void
}

export default function SimulationRunner({ simulation, onError }: SimulationRunnerProps) {
  if (!simulation) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] text-gray-500">
        <div className="text-center">
          <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No simulation selected</p>
        </div>
      </div>
    )
  }

  if (simulation.type === "REACT" && simulation.reactCode) {
    return (
      <SimulationErrorBoundary codeKey={simulation.reactCode}>
        <ReactRunner code={simulation.reactCode} onError={onError} />
      </SimulationErrorBoundary>
    )
  }

  if (simulation.type === "GEOGEBRA_FILE" && simulation.geogebraFile) {
    return <GeoGebraFileRunner fileUrl={simulation.geogebraFile} settings={simulation.geogebraSettings} />
  }

  if (simulation.type === "GEOGEBRA_API") {
    return <GeoGebraAPIRunner commands={simulation.geogebraCommands} settings={simulation.geogebraSettings} />
  }

  return (
    <div className="flex items-center justify-center h-full min-h-[400px] text-gray-500">
      <div className="text-center">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-amber-500" />
        <p>Simulation type not recognized</p>
      </div>
    </div>
  )
}

function ReactRunner({ code, onError }: { code: string; onError?: (error: string | null) => void }) {
  // Memoize cleaned code to prevent re-render loops
  const cleanCode = useMemo(() => {
    return code
      .replace(/import\s+[\s\S]*?from\s+['"].*?['"];?/g, '')
      // Also strip ```jsx / ``` markdown fences
      .replace(/^```(?:jsx|tsx|javascript|typescript)\s*/gm, '')
      .replace(/```\s*$/gm, '')
      // Strip prose text before export default function
      .replace(/^[\s\S]*?(?=export\s+default\s+function)/m, '')
      .trim()
  }, [code])

  // Stable scope object - memoized so useRunner doesn't re-init on every render
  const scope = useMemo(() => {
    // Fallback icon component for any Lucide icon name not explicitly imported
    const FallbackIcon = ({ className, ...props }: any) =>
      React.createElement('svg', {
        xmlns: 'http://www.w3.org/2000/svg',
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        className: className || 'h-4 w-4',
        ...props,
      }, React.createElement('circle', { cx: 12, cy: 12, r: 10 }))

    // Build scope object. react-runner resolves variables via Object.keys(scope)
    // so every name used in AI-generated code must exist as a key here.
    const s: Record<string, any> = {
      // React core
      React,
      useState: React.useState,
      useEffect: React.useEffect,
      useRef: React.useRef,
      useCallback: React.useCallback,
      useMemo: React.useMemo,
      useReducer: React.useReducer,
      useContext: React.useContext,
      createContext: React.createContext,
      Fragment: React.Fragment,
      createElement: React.createElement,
      cloneElement: React.cloneElement,
      Children: React.Children,
      forwardRef: React.forwardRef,
      memo: React.memo,

      // motion shim
      motion,

      // Common Lucide icons
      Play, Pause, RotateCcw, Settings, AlertCircle, Sparkles, Plus, Minus,
      ArrowRight, ArrowLeft, ArrowUp, ArrowDown, RefreshCw,
      ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
      Info, HelpCircle, Check, X, Zap,
      Thermometer, Droplets, Wind, Sun, Moon, Atom, FlaskConical, Ruler, Timer,
      Eye, EyeOff, Volume2, VolumeX,

      // Recharts
      LineChart, BarChart, AreaChart, ScatterChart,
      Line, Bar, Area, Scatter,
      XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
      PieChart: FallbackIcon, Pie: FallbackIcon, Cell: FallbackIcon,
      RadarChart: FallbackIcon, Radar: FallbackIcon, PolarGrid: FallbackIcon,
      PolarAngleAxis: FallbackIcon, PolarRadiusAxis: FallbackIcon,

      // Shadcn UI components
      Button, Card, CardContent, CardHeader, CardTitle, CardDescription,
      Input, Label, Slider,

      // Common globals AI code may reference
      Math, Number, String, Array, Object, JSON, Date, Map, Set,
      parseInt, parseFloat, isNaN, isFinite, undefined,
      console, setTimeout, clearTimeout, setInterval, clearInterval,
      Promise, Error, RegExp, Symbol, Infinity, NaN,
      encodeURIComponent, decodeURIComponent, encodeURI, decodeURI,
      requestAnimationFrame: typeof window !== 'undefined' ? window.requestAnimationFrame : () => 0,
      cancelAnimationFrame: typeof window !== 'undefined' ? window.cancelAnimationFrame : () => {},
      document: typeof document !== 'undefined' ? document : undefined,
      window: typeof window !== 'undefined' ? window : undefined,

      // Science data constants (used by AI-generated simulations)
      ELEMENTS,
      PHYSICS_CONSTANTS,
      AMINO_ACIDS,
      elements: ELEMENTS,           // lowercase alias
      periodicTable: ELEMENTS,      // common alias
      physicsConstants: PHYSICS_CONSTANTS,
      aminoAcids: AMINO_ACIDS,
    }
    return s
  }, [])

  const { element, error } = useRunner({ 
    code: cleanCode, 
    scope,
  })

  // Report errors to parent
  useEffect(() => {
    if (onError) {
      onError(error || null)
    }
  }, [error, onError])

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-md overflow-auto border border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800">
        <h3 className="font-bold mb-2 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Simulation Error
        </h3>
        <pre className="text-xs font-mono whitespace-pre-wrap">{error}</pre>
      </div>
    )
  }

  return (
    <SimulationErrorBoundary codeKey={cleanCode}>
      <div className="simulation-container w-full h-full min-h-[400px]">{element}</div>
    </SimulationErrorBoundary>
  )
}

/**
 * Lazy-load GeoGebra deployggb.js only when needed (backward compat for saved sims)
 */
function loadGeoGebraScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).GGBApplet) {
      resolve()
      return
    }
    const s = document.createElement('script')
    s.src = 'https://www.geogebra.org/apps/deployggb.js'
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Failed to load GeoGebra script'))
    document.head.appendChild(s)
  })
}

function GeoGebraFileRunner({ fileUrl, settings }: { fileUrl: string; settings?: any }) {
  const containerRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    if (!containerRef.current || typeof window === 'undefined') return
    let cancelled = false
    
    loadGeoGebraScript().then(() => {
      if (cancelled || !containerRef.current) return
      
      const containerWidth = containerRef.current?.clientWidth || 800
      const containerHeight = containerRef.current?.clientHeight || 600
      const params = {
        filename: fileUrl,
        width: settings?.width || containerWidth,
        height: settings?.height || containerHeight,
        showToolBar: settings?.showToolBar ?? false,
        showAlgebraInput: settings?.showAlgebraInput ?? false,
        showMenuBar: settings?.showMenuBar ?? false,
        ...settings
      }
      
      const applet = new (window as any).GGBApplet(params, true)
      applet.inject(containerRef.current)
    }).catch(console.error)

    return () => {
      cancelled = true
      if (containerRef.current) containerRef.current.innerHTML = ''
    }
  }, [fileUrl, settings])
  
  return <div ref={containerRef} className="w-full h-full min-h-[600px]" />
}

function GeoGebraAPIRunner({ commands, settings }: { commands?: any; settings?: any }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const appletId = React.useRef(`ggb_${Math.random().toString(36).slice(2, 8)}`)
  
  useEffect(() => {
    if (!containerRef.current || typeof window === 'undefined') return
    let cancelled = false
    
    loadGeoGebraScript().then(() => {
      if (cancelled || !containerRef.current) return
      
      try {
        const commandList = Array.isArray(commands?.commands) ? commands.commands : 
                            Array.isArray(commands) ? commands : []
        const geoSettings = commands?.settings || settings || {}
        
        const containerId = appletId.current

        const containerWidth = containerRef.current?.clientWidth || 800
        const containerHeight = containerRef.current?.clientHeight || 600
        const params = {
          appName: "classic",
          width: geoSettings.width || containerWidth,
          height: geoSettings.height || containerHeight,
          showToolBar: geoSettings.showToolBar ?? false,
          showAlgebraInput: geoSettings.showAlgebraInput ?? true,
          showMenuBar: geoSettings.showMenuBar ?? false,
          id: containerId,
          appletOnLoad: () => {
            if (cancelled) return
            setLoading(false)
            const api = (window as any)[containerId] || (window as any).ggbApplet
            if (api && commandList.length > 0) {
              const errors: string[] = []
              commandList.forEach((cmd: string) => {
                try {
                  const success = api.evalCommand(cmd)
                  if (!success) errors.push(`Failed: ${cmd}`)
                } catch (e: any) {
                  errors.push(`Error in "${cmd}": ${e.message}`)
                }
              })
              if (errors.length > commandList.length / 2) {
                setError(`Some commands failed:\\n${errors.join('\\n')}`)
              }
            }
          },
          ...geoSettings
        }
        
        const applet = new (window as any).GGBApplet(params, true)
        containerRef.current.innerHTML = ''
        applet.inject(containerRef.current)
      } catch (e: any) {
        setError(e.message || 'Failed to initialize GeoGebra')
        setLoading(false)
      }
    }).catch(err => {
      setError('GeoGebra script failed to load. Please refresh.')
      setLoading(false)
    })

    return () => {
      cancelled = true
      // Cleanup: remove applet global + clear DOM
      try { delete (window as any)[appletId.current] } catch {}
      if (containerRef.current) containerRef.current.innerHTML = ''
    }
  }, [commands, settings])
  
  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-md">
        <h3 className="font-bold mb-2">GeoGebra Error</h3>
        <pre className="text-xs font-mono whitespace-pre-wrap">{error}</pre>
      </div>
    )
  }
  
  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-lg z-10">
          <div className="text-center text-sm text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2" />
            Loading GeoGebra...
          </div>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full min-h-[600px]" />
    </div>
  )
}
