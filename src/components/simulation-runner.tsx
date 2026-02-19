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
      
      const params = {
        filename: fileUrl,
        width: settings?.width || 800,
        height: settings?.height || 600,
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

        const params = {
          appName: "classic",
          width: geoSettings.width || 800,
          height: geoSettings.height || 600,
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
