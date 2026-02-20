"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Sparkles, Send, Loader2, Save, AlertCircle, 
  Code, Eye, Wrench, RotateCcw, History, ChevronDown, ChevronUp,
  ImagePlus, X
} from "lucide-react"
import { 
  generateSimulationAction, 
  refineSimulationAction, 
  saveSimulationAction,
  healSimulationAction,
  generateDescriptionAction
} from "./actions"
import SimulationRunner from "@/components/simulation-runner"
import { useRouter } from "next/navigation"
import { useImageUpload } from "@/lib/use-image-upload"
import { cn } from "@/lib/utils"
import { ImagePreviewBar } from "@/components/image-preview-bar"

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  images?: string[]
}

interface VersionEntry {
  version: number
  code: string
  timestamp: number
  prompt?: string
}

interface InitialSimulation {
  id: string
  title: string
  description: string | null
  subject: string
  type: 'REACT' | 'GEOGEBRA_API'
  code: string
  versionHistory: VersionEntry[]
}

// Robust code cleaner - strips markdown fences, explanations, imports
function cleanCode(code: string): string {
  let text = code.trim()
  
  // Strip markdown code fences
  const fenceMatch = text.match(/```(?:jsx|tsx|javascript|typescript|react|json)?\s*\n([\s\S]*?)```/)
  if (fenceMatch) {
    text = fenceMatch[1].trim()
  }
  
  // Remove stray fence markers
  text = text
    .replace(/^```(?:jsx|tsx|javascript|typescript|react|json)?\s*/gm, '')
    .replace(/```\s*$/gm, '')
    .trim()
  
  return text
}

const DRAFT_KEY_PREFIX = "sandbox-draft-"

export default function SandboxStudio({ 
  hasApiKey,
  initialSimulation 
}: { 
  hasApiKey: boolean
  initialSimulation?: InitialSimulation
}) {
  const router = useRouter()
  const isEditing = !!initialSimulation
  
  // Creation state
  const [step, setStep] = useState<'setup' | 'chat'>(isEditing ? 'chat' : 'setup')
  const [simulationType, setSimulationType] = useState<'REACT' | 'GEOGEBRA_API'>(initialSimulation?.type || 'REACT')
  const [subject, setSubject] = useState(initialSimulation?.subject || 'Physics')
  const [initialPrompt, setInitialPrompt] = useState('')
  
  // Chat state
  const [messages, setMessages] = useState<Message[]>(
    isEditing ? [{ role: 'system', content: `Editing: ${initialSimulation!.title}. Describe changes to refine.` }] : []
  )
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  
  // Simulation state
  const [currentCode, setCurrentCode] = useState(initialSimulation?.code || '')
  const [currentType, setCurrentType] = useState<'REACT' | 'GEOGEBRA_API'>(initialSimulation?.type || 'REACT')
  const [variables, setVariables] = useState<any[]>([])
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [healing, setHealing] = useState(false)
  const [healAttempts, setHealAttempts] = useState(0)
  
  // Save state
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveTitle, setSaveTitle] = useState(initialSimulation?.title || '')
  const [saveDescription, setSaveDescription] = useState(initialSimulation?.description || '')
  const [savePublic, setSavePublic] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generatingDesc, setGeneratingDesc] = useState(false)
  
  // Version history
  const [versionHistory, setVersionHistory] = useState<VersionEntry[]>(initialSimulation?.versionHistory || [])
  const [showHistory, setShowHistory] = useState(false)
  
  // Draft restoration
  const [hasDraft, setHasDraft] = useState(false)
  const draftKey = isEditing ? `${DRAFT_KEY_PREFIX}${initialSimulation!.id}` : `${DRAFT_KEY_PREFIX}new`

  const chatEndRef = useRef<HTMLDivElement>(null)

  // Prevent hydration mismatch from Radix Select IDs (server vs client)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  
  // Image upload (shared between setup and chat)
  const imageUpload = useImageUpload(4)
  
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Check for saved draft on mount
  useEffect(() => {
    if (isEditing) return // Skip draft check for edit mode
    try {
      const draft = localStorage.getItem(draftKey)
      if (draft) {
        setHasDraft(true)
      }
    } catch {}
  }, [draftKey, isEditing])

  // Auto-save draft when code changes (debounced)
  useEffect(() => {
    if (!currentCode || step !== 'chat') return
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({
          code: currentCode,
          type: currentType,
          subject,
          messages,
          timestamp: Date.now(),
        }))
      } catch {}
    }, 5000)
    return () => clearTimeout(timer)
  }, [currentCode, currentType, subject, messages, draftKey, step])

  function restoreDraft() {
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey) || '{}')
      if (draft.code) {
        setCurrentCode(draft.code)
        setCurrentType(draft.type || 'REACT')
        setSubject(draft.subject || 'Physics')
        setMessages(draft.messages || [])
        setStep('chat')
        setHasDraft(false)
      }
    } catch {}
  }

  function dismissDraft() {
    localStorage.removeItem(draftKey)
    setHasDraft(false)
  }
  
  // Handle initial generation
  async function handleGenerate() {
    if (!initialPrompt.trim() && imageUpload.pendingImages.length === 0) return
    
    setLoading(true)
    setStep('chat')
    setHealAttempts(0)
    setPreviewError(null)
    const images = [...imageUpload.pendingImages]
    setMessages([{ role: 'user', content: initialPrompt, images: images.length > 0 ? images : undefined }])
    imageUpload.clearImages()
    
    const result = await generateSimulationAction(initialPrompt, subject, simulationType, images.length > 0 ? images : undefined)
    
    if (result.success && result.code) {
      const cleaned = cleanCode(result.code)
      setCurrentCode(cleaned)
      setCurrentType(result.type!)
      setVariables(result.variables || [])
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✨ Generated your ${simulationType === 'REACT' ? 'React' : 'GeoGebra'} simulation! Check the preview on the right.\n\nDescribe any changes you'd like to make.`
      }])
    } else {
      setMessages(prev => [...prev, {
        role: 'system',
        content: `❌ Error: ${result.error}`
      }])
    }
    
    setLoading(false)
  }
  
  // Handle refinement
  async function handleRefine(e: React.FormEvent) {
    e.preventDefault()
    if ((!input.trim() && imageUpload.pendingImages.length === 0) || !currentCode) return
    
    const userMessage = input.trim()
    const images = [...imageUpload.pendingImages]
    setInput('')
    imageUpload.clearImages()
    setMessages(prev => [...prev, { role: 'user', content: userMessage, images: images.length > 0 ? images : undefined }])
    setLoading(true)
    setHealAttempts(0)
    setPreviewError(null)
    
    const result = await refineSimulationAction(currentCode, userMessage, currentType, images.length > 0 ? images : undefined)
    
    if (result.success && result.code) {
      const cleaned = cleanCode(result.code)
      setCurrentCode(cleaned)
      setVariables(result.variables || [])
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '✅ Updated! Check the preview.'
      }])
    } else {
      setMessages(prev => [...prev, {
        role: 'system',
        content: `❌ Error: ${result.error}`
      }])
    }
    
    setLoading(false)
  }
  
  // Manual fix error button
  async function handleFixError() {
    if (!previewError || !currentCode || healing) return
    
    setHealing(true)
    setMessages(prev => [...prev, {
      role: 'system',
      content: `🔧 Attempting to fix: ${previewError.substring(0, 100)}...`
    }])
    
    const result = await healSimulationAction(currentCode, previewError, currentType)
    
    if (result.success && 'code' in result && result.code) {
      const cleaned = cleanCode(result.code)
      setCurrentCode(cleaned)
      setPreviewError(null)
      setHealAttempts(prev => prev + 1)
      setMessages(prev => [...prev, {
        role: 'system',
        content: '✅ Fix applied! Check the preview.'
      }])
    } else {
      setHealAttempts(prev => prev + 1)
      setMessages(prev => [...prev, {
        role: 'system',
        content: `❌ Auto-fix failed: ${result.error}. Try describing the issue manually.`
      }])
    }
    
    setHealing(false)
  }
  
  // Handle save
  async function handleSave() {
    if (!saveTitle.trim() || !currentCode) return
    
    setSaving(true)
    
    try {
      let geoCommands = undefined
      if (currentType === 'GEOGEBRA_API') {
        try {
          geoCommands = JSON.parse(currentCode)
        } catch {
          geoCommands = { commands: [currentCode] }
        }
      }

      // Build version history entry
      const newVersion: VersionEntry = {
        version: versionHistory.length + 1,
        code: currentCode,
        timestamp: Date.now(),
        prompt: messages.filter(m => m.role === 'user').pop()?.content,
      }
      const updatedHistory = [...versionHistory, newVersion]

      const data = {
        title: saveTitle,
        description: saveDescription,
        subject: subject,
        type: currentType === 'REACT' ? 'REACT' as const : 'GEOGEBRA_API' as const,
        reactCode: currentType === 'REACT' ? currentCode : undefined,
        geogebraCommands: geoCommands,
        variables: variables,
        isPublic: savePublic,
        simulationId: isEditing ? initialSimulation!.id : undefined,
        versionHistory: updatedHistory,
      }
      
      const result = await saveSimulationAction(data)
      
      if (result.success) {
        // Clear draft
        try { localStorage.removeItem(draftKey) } catch {}
        setVersionHistory(updatedHistory)
        setMessages(prev => [...prev, {
          role: 'system',
          content: isEditing ? '✅ Updated! Redirecting...' : '✅ Saved! Redirecting...'
        }])
        router.push('/sandbox')
      } else {
        alert('Failed to save: ' + result.error)
      }
    } catch (error: any) {
      alert('Failed to save: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  // Auto-generate description
  async function handleGenerateDescription() {
    if (!currentCode || generatingDesc) return
    setGeneratingDesc(true)
    try {
      const result = await generateDescriptionAction(currentCode, subject)
      if (result.success && result.description) {
        setSaveDescription(result.description)
      }
    } catch {}
    setGeneratingDesc(false)
  }

  // Restore version from history
  function restoreVersion(entry: VersionEntry) {
    setCurrentCode(entry.code)
    setPreviewError(null)
    setHealAttempts(0)
    setMessages(prev => [...prev, {
      role: 'system',
      content: `Restored to version ${entry.version} (${new Date(entry.timestamp).toLocaleString()})`
    }])
  }
  
  // Reset to start over
  function handleReset() {
    router.push('/sandbox')
  }
  
  if (!hasApiKey) {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              API Key Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              To use the AI Sandbox, you need to add an API key in Settings.
            </p>
            <Button onClick={() => router.push('/dashboard/settings')} className="w-full">
              Go to Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }
  
  if (!mounted) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <Card className="shadow-lg">
          <CardContent className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    )
  }
  
  if (step === 'setup') {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <Card className="shadow-lg">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl flex items-center justify-center gap-3">
              <Sparkles className="h-7 w-7 text-purple-500" />
              {isEditing ? `Edit: ${initialSimulation?.title}` : 'New Simulation'}
            </CardTitle>
            <p className="text-muted-foreground mt-2">
              Describe what you want to build and AI will generate an interactive simulation
            </p>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            {/* Draft restoration banner */}
            {hasDraft && (
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-center justify-between">
                <p className="text-sm text-blue-700 dark:text-blue-300">You have an unsaved draft.</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={dismissDraft}>Discard</Button>
                  <Button size="sm" onClick={restoreDraft}>Restore</Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label className="text-sm font-medium">Subject</Label>
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Physics">🔬 Physics</SelectItem>
                    <SelectItem value="Chemistry">⚗️ Chemistry</SelectItem>
                    <SelectItem value="Biology">🧬 Biology</SelectItem>
                    <SelectItem value="Maths">📊 Maths</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">Describe Your Simulation</Label>
              <Textarea 
                placeholder="E.g., Create a car collision simulation where two cars move toward each other. Show momentum conservation with sliders for mass and velocity."
                value={initialPrompt}
                onChange={(e) => setInitialPrompt(e.target.value)}
                onPaste={imageUpload.handlePaste}
                rows={4}
                className="resize-none text-base"
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={imageUpload.triggerUpload}
                  className="gap-1.5"
                >
                  <ImagePlus className="h-4 w-4" />
                  Upload Image
                </Button>
                <input
                  ref={imageUpload.inputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) imageUpload.addImages(e.target.files)
                    e.target.value = ''
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Upload a textbook photo, diagram, or screenshot. Also supports paste (Ctrl+V).
                </p>
              </div>
              <ImagePreviewBar images={imageUpload.pendingImages} onRemove={imageUpload.removeImage} />
            </div>
            
            <Button 
              onClick={handleGenerate} 
              disabled={(!initialPrompt.trim() && imageUpload.pendingImages.length === 0) || loading}
              className="w-full h-12 text-base"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating (may take 15-30s)...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Generate Simulation
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }
  
  // Chat + Preview Mode
  const [mobileTab, setMobileTab] = useState<'chat' | 'preview'>('chat')
  
  return (
    <div className="flex flex-col md:flex-row -mx-4 md:-mx-8 -mt-8 -mb-8" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Mobile tab switcher */}
      <div className="flex md:hidden border-b bg-background shrink-0">
        <button
          onClick={() => setMobileTab('chat')}
          className={cn(
            "flex-1 py-2.5 text-sm font-medium text-center border-b-2 transition-colors",
            mobileTab === 'chat' ? "border-primary text-primary" : "border-transparent text-muted-foreground"
          )}
        >
          <Sparkles className="h-4 w-4 inline mr-1" />
          AI Studio
        </button>
        <button
          onClick={() => setMobileTab('preview')}
          className={cn(
            "flex-1 py-2.5 text-sm font-medium text-center border-b-2 transition-colors",
            mobileTab === 'preview' ? "border-primary text-primary" : "border-transparent text-muted-foreground"
          )}
        >
          <Eye className="h-4 w-4 inline mr-1" />
          Preview
        </button>
      </div>
      
      {/* Left: Chat Panel */}
      <div className={cn(
        "w-full md:w-[380px] md:min-w-[320px] border-r flex flex-col bg-muted/30 flex-1 md:flex-initial",
        mobileTab !== 'chat' && "hidden md:flex"
      )}>
        <div className="p-3 border-b bg-background flex items-center justify-between">
          <div>
            <h2 className="font-semibold flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-purple-500" />
              AI Studio
            </h2>
            <p className="text-xs text-muted-foreground">
              Describe changes to refine your simulation
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleReset} title="Start over">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : msg.role === 'system'
                    ? 'bg-amber-50 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200 border border-amber-200 dark:border-amber-800'
                    : 'bg-muted'
                }`}
              >
                {msg.images && msg.images.length > 0 && (
                  <div className="flex gap-1.5 mb-1.5 flex-wrap">
                    {msg.images.map((src, j) => (
                      <img key={j} src={src} alt="" className="h-16 w-16 rounded object-cover border border-white/20" />
                    ))}
                  </div>
                )}
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>AI is thinking...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        
        {/* Error fix bar */}
        {previewError && !loading && (
          <div className="px-3 py-2 border-t bg-red-50 dark:bg-red-950/30">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-red-600 dark:text-red-400 line-clamp-2 font-mono">{previewError}</p>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="mt-1.5 h-7 text-xs border-red-300 text-red-600 hover:bg-red-100"
                  onClick={handleFixError}
                  disabled={healing || healAttempts >= 3}
                >
                  {healing ? (
                    <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Fixing...</>
                  ) : healAttempts >= 3 ? (
                    'Max attempts reached - describe the fix manually'
                  ) : (
                    <><Wrench className="mr-1 h-3 w-3" /> Auto-Fix Error ({3 - healAttempts} left)</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
        
        <form onSubmit={handleRefine} className="p-3 border-t bg-background">
          {imageUpload.pendingImages.length > 0 && (
            <ImagePreviewBar images={imageUpload.pendingImages} onRemove={imageUpload.removeImage} compact />
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={imageUpload.triggerUpload}
              title="Upload image"
            >
              <ImagePlus className="h-4 w-4" />
            </Button>
            <input
              ref={imageUpload.inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) imageUpload.addImages(e.target.files)
                e.target.value = ''
              }}
            />
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={imageUpload.handlePaste}
              placeholder="E.g., Add a slider for speed..."
              disabled={loading || !currentCode}
              className="text-sm"
            />
            <Button type="submit" size="icon" disabled={loading || !currentCode || (!input.trim() && imageUpload.pendingImages.length === 0)}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
        
        <div className="p-3 border-t space-y-2">
          <div className="flex gap-2">
            <Button onClick={() => setShowSaveDialog(!showSaveDialog)} className="flex-1" variant="outline" size="sm">
              <Save className="mr-2 h-4 w-4" />
              {isEditing ? 'Update' : 'Save to Library'}
            </Button>
            {versionHistory.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)} title="Version History">
                <History className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          {/* Version History Panel */}
          {showHistory && versionHistory.length > 0 && (
            <Card>
              <CardContent className="pt-3 space-y-2 max-h-[200px] overflow-y-auto">
                <p className="text-xs font-medium text-muted-foreground">Version History</p>
                {versionHistory.slice().reverse().map((v) => (
                  <div key={v.version} className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-muted">
                    <div className="min-w-0">
                      <span className="font-medium">v{v.version}</span>
                      <span className="text-muted-foreground ml-2">{new Date(v.timestamp).toLocaleString()}</span>
                      {v.prompt && <p className="text-muted-foreground truncate">{v.prompt}</p>}
                    </div>
                    <Button size="sm" variant="ghost" className="h-6 text-xs shrink-0" onClick={() => restoreVersion(v)}>
                      Restore
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          
          {showSaveDialog && (
            <Card>
              <CardContent className="pt-4 space-y-3">
                <Input
                  placeholder="Simulation Title"
                  value={saveTitle}
                  onChange={(e) => setSaveTitle(e.target.value)}
                  className="text-sm"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Textarea
                      placeholder="Description (optional)"
                      value={saveDescription}
                      onChange={(e) => setSaveDescription(e.target.value)}
                      rows={2}
                      className="text-sm resize-none"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-8 w-8"
                      onClick={handleGenerateDescription}
                      disabled={generatingDesc || !currentCode}
                      title="Auto-generate description with AI"
                    >
                      {generatingDesc ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="public"
                    checked={savePublic}
                    onChange={(e) => setSavePublic(e.target.checked)}
                  />
                  <Label htmlFor="public" className="text-sm">Publish to Community</Label>
                </div>
                <Button onClick={handleSave} disabled={!saveTitle.trim() || saving} className="w-full" size="sm">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {isEditing ? 'Update' : 'Save'}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      
      {/* Right: Preview */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0",
        mobileTab !== 'preview' && "hidden md:flex"
      )}>
        <Tabs defaultValue="preview" className="flex-1 flex flex-col">
          <div className="border-b px-4">
            <TabsList>
              <TabsTrigger value="preview">
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </TabsTrigger>
              <TabsTrigger value="code">
                <Code className="h-4 w-4 mr-2" />
                Code
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="preview" className="flex-1 m-0 p-4 overflow-auto">
            {currentCode ? (
              <SimulationRunner
                simulation={{
                  type: currentType,
                  reactCode: currentType === 'REACT' ? currentCode : null,
                  geogebraCommands: currentType === 'GEOGEBRA_API' ? (() => { try { return JSON.parse(currentCode) } catch { return { commands: [currentCode] } } })() : null
                }}
                onError={setPreviewError}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>Your simulation preview will appear here</p>
                </div>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="code" className="flex-1 m-0 p-4">
            <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto h-full font-mono leading-relaxed">
              <code>{currentCode || 'No code yet'}</code>
            </pre>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
