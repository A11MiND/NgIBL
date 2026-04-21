"use client"

import React, { useState, useRef, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Sparkles, Send, Loader2, Save, AlertCircle, 
  Code, Eye, Wrench, RotateCcw, History,
  ImagePlus, X
} from "lucide-react"
import { 
  generateSimulationAction, 
  refineSimulationAction, 
  saveSimulationAction,
  healSimulationAction,
  generateDescriptionAction,
  persistCheckpointAction,
  rewritePromptAction,
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
  kind?: 'version' | 'checkpoint'
  type?: 'REACT'
}

interface CheckpointEntry {
  code: string
  type: 'REACT'
  timestamp: number
  reason: string
  persisted?: boolean
}

interface InitialSimulation {
  id: string
  title: string
  description: string | null
  subject: string
  type: 'REACT'
  code: string
  versionHistory: VersionEntry[]
  chatHistory?: Message[] | null
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
const MemoSimulationRunner = React.memo(SimulationRunner)

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
  const [simulationType] = useState<'REACT'>(initialSimulation?.type || 'REACT')
  const [subject, setSubject] = useState(initialSimulation?.subject || 'Physics')
  const [initialPrompt, setInitialPrompt] = useState('')
  const [rewritingPrompt, setRewritingPrompt] = useState(false)
  
  // Chat state
  const [messages, setMessages] = useState<Message[]>(
    isEditing
      ? (initialSimulation!.chatHistory?.length
          ? (initialSimulation!.chatHistory as Message[])
          : [{ role: 'system', content: `Editing: ${initialSimulation!.title}. Describe changes to refine.` }])
      : []
  )
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [runStage, setRunStage] = useState('')
  const [runProgress, setRunProgress] = useState(0)
  
  // Simulation state
  const [currentCode, setCurrentCode] = useState(initialSimulation?.code || '')
  const [currentType, setCurrentType] = useState<'REACT'>(initialSimulation?.type || 'REACT')
  const [variables, setVariables] = useState<unknown[]>([])
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
  const [versionHistory, setVersionHistory] = useState<VersionEntry[]>(
    (initialSimulation?.versionHistory || []).filter((entry) => entry.kind !== 'checkpoint')
  )
  const [showHistory, setShowHistory] = useState(false)
  const [checkpoints, setCheckpoints] = useState<CheckpointEntry[]>(
    (initialSimulation?.versionHistory || [])
      .filter((entry) => entry.kind === 'checkpoint')
      .slice(-20)
      .map((entry) => ({
        code: entry.code,
        type: entry.type || initialSimulation?.type || 'REACT',
        timestamp: entry.timestamp,
        reason: (entry.prompt || 'Checkpoint').replace(/^\[checkpoint\]\s*/i, ''),
        persisted: true,
      }))
  )
  const [historySummary, setHistorySummary] = useState<string | undefined>(undefined)
  
  // Mobile responsive tab (chat vs preview)
  const [mobileTab, setMobileTab] = useState<'chat' | 'preview'>('chat')
  
  // Paste-code mode
  const [pastedCode, setPastedCode] = useState('')
  
  // Draft restoration
  const [hasDraft, setHasDraft] = useState(false)
  const draftKey = isEditing ? `${DRAFT_KEY_PREFIX}${initialSimulation!.id}` : `${DRAFT_KEY_PREFIX}new`

  const chatEndRef = useRef<HTMLDivElement>(null)
  const refineFormRef = useRef<HTMLFormElement>(null)
  const refineInputRef = useRef<HTMLTextAreaElement>(null)
  const activeRunIdRef = useRef(0)
  const runTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pendingCheckpointRef = useRef<number | null>(null)

  // Prevent hydration mismatch from Radix Select IDs (server vs client)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  
  // Image upload (shared between setup and chat)
  const imageUpload = useImageUpload(4)
  
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!refineInputRef.current) return
    refineInputRef.current.style.height = 'auto'
    refineInputRef.current.style.height = `${Math.min(refineInputRef.current.scrollHeight, 140)}px`
  }, [input])

  function startRun(kind: 'generate' | 'refine' | 'heal') {
    const runId = Date.now()
    activeRunIdRef.current = runId
    if (runTimerRef.current) clearInterval(runTimerRef.current)

    setRunProgress(8)
    setRunStage(
      kind === 'generate'
        ? 'Preparing generation context...'
        : kind === 'refine'
        ? 'Reading current simulation and applying edits...'
        : 'Analyzing runtime error and preparing fix...'
    )

    runTimerRef.current = setInterval(() => {
      setRunProgress((prev) => {
        if (prev >= 92) return prev
        if (prev < 50) return prev + 7
        if (prev < 80) return prev + 4
        return prev + 2
      })
    }, 700)
    setLoading(true)
    return runId
  }

  function finishRun(runId: number) {
    if (activeRunIdRef.current === runId) {
      if (runTimerRef.current) clearInterval(runTimerRef.current)
      runTimerRef.current = null
      setRunProgress(100)
      setTimeout(() => {
        setRunProgress(0)
        setRunStage('')
      }, 250)
      setLoading(false)
    }
  }

  function isStaleRun(runId: number) {
    return activeRunIdRef.current !== runId
  }

  function stopCurrentRun() {
    activeRunIdRef.current = Date.now()
    if (runTimerRef.current) clearInterval(runTimerRef.current)
    runTimerRef.current = null
    if (pendingCheckpointRef.current !== null) {
      const targetTs = pendingCheckpointRef.current
      setCheckpoints((prev) => prev.filter((cp) => cp.timestamp !== targetTs))
      pendingCheckpointRef.current = null
    }
    setRunProgress(0)
    setRunStage('')
    setLoading(false)
    setHealing(false)
    setMessages((prev) => [...prev, {
      role: 'system',
      content: '⏹️ Stopped. The current AI response was canceled on the client side.'
    }])
  }

  // Check for saved draft on mount
  useEffect(() => {
    try {
      const draft = localStorage.getItem(draftKey)
      if (draft) {
        if (isEditing) {
          const parsed = JSON.parse(draft)
          if (parsed?.code) {
            setCurrentCode(parsed.code)
            setCurrentType(parsed.type || 'REACT')
            setSubject(parsed.subject || 'Physics')
            setMessages(parsed.messages || [])
            setCheckpoints(Array.isArray(parsed.checkpoints) ? parsed.checkpoints : [])
            setHistorySummary(parsed.historySummary || undefined)
            setStep('chat')
          }
        } else {
          setHasDraft(true)
        }
      }
    } catch {}
  }, [draftKey, isEditing])

  useEffect(() => {
    return () => {
      if (runTimerRef.current) clearInterval(runTimerRef.current)
    }
  }, [])

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
          checkpoints,
          historySummary,
          timestamp: Date.now(),
        }))
      } catch {}
    }, 10 * 60 * 1000)
    return () => clearTimeout(timer)
  }, [currentCode, currentType, subject, messages, checkpoints, historySummary, draftKey, step])

  function restoreDraft() {
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey) || '{}')
      if (draft.code) {
        setCurrentCode(draft.code)
        setCurrentType(draft.type || 'REACT')
        setSubject(draft.subject || 'Physics')
        setMessages(draft.messages || [])
        setCheckpoints(Array.isArray(draft.checkpoints) ? draft.checkpoints : [])
        setHistorySummary(draft.historySummary || undefined)
        setStep('chat')
        setHasDraft(false)
      }
    } catch {}
  }

  function dismissDraft() {
    localStorage.removeItem(draftKey)
    setHasDraft(false)
  }

  function createCheckpoint(reason: string): CheckpointEntry | null {
    if (!currentCode) return null
    const entry: CheckpointEntry = {
      code: currentCode,
      type: currentType,
      timestamp: Date.now(),
      reason,
      persisted: false,
    }
    setCheckpoints((prev) => [...prev.slice(-19), entry])
    return entry
  }

  function persistCheckpoint(entry: CheckpointEntry) {
    if (!isEditing || !initialSimulation?.id) return
    void persistCheckpointAction(initialSimulation.id, {
      code: entry.code,
      type: entry.type,
      timestamp: entry.timestamp,
      reason: entry.reason,
    }).then((result) => {
      if (!result.success) return
      setCheckpoints((prev) =>
        prev.map((cp) =>
          cp.timestamp === entry.timestamp && cp.reason === entry.reason
            ? { ...cp, persisted: true }
            : cp
        )
      )
    }).catch(() => {
      // Keep local checkpoint even if persistence fails.
    })
  }

  function restoreLatestCheckpoint() {
    if (checkpoints.length === 0) return
    restoreCheckpointAt(checkpoints.length - 1)
  }

  function restoreCheckpointAt(index: number) {
    const cp = checkpoints[index]
    if (!cp) return
    setCurrentCode(cp.code)
    setCurrentType(cp.type)
    setPreviewError(null)
    setHealAttempts(0)
    setCheckpoints(prev => prev.filter((_, i) => i !== index))
    setMessages(prev => [...prev, {
      role: 'system',
      content: `⏮️ Restored: ${cp.reason} (${new Date(cp.timestamp).toLocaleTimeString()})`
    }])
  }
  
  // Load pasted code directly into editor (skip AI generation)
  function handleLoadCode() {
    const cleaned = cleanCode(pastedCode.trim())
    if (!cleaned) return
    setCurrentCode(cleaned)
    setCurrentType('REACT')
    setStep('chat')
    setMessages([{ role: 'system', content: `📋 Loaded pasted code (${subject}). Describe what you'd like to change or improve.` }])
  }

  // Handle initial generation
  async function handleGenerate() {
    if (!initialPrompt.trim() && imageUpload.pendingImages.length === 0) return

    const runId = startRun('generate')
    setStep('chat')
    setHealAttempts(0)
    setPreviewError(null)
    const images = [...imageUpload.pendingImages]
    setMessages([{ role: 'user', content: initialPrompt, images: images.length > 0 ? images : undefined }])
    imageUpload.clearImages()
    
    const result = await generateSimulationAction(initialPrompt, subject, simulationType, images.length > 0 ? images : undefined)

    if (isStaleRun(runId)) return
    
    if (result.success && result.code) {
      const cleaned = cleanCode(result.code)
      setCurrentCode(cleaned)
      setCurrentType(result.type!)
      setVariables(result.variables || [])
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '✨ Generated your React simulation! Check the preview on the right.\n\nDescribe any changes you\'d like to make.'
      }])
    } else {
      setMessages(prev => [...prev, {
        role: 'system',
        content: `❌ Error: ${result.error}`
      }])
    }
    
    finishRun(runId)
  }

  async function handleRewritePrompt() {
    const raw = initialPrompt.trim()
    if (!raw || rewritingPrompt) return
    setRewritingPrompt(true)
    try {
      const result = await rewritePromptAction(raw, subject)
      if (result.success && result.rewrittenPrompt) {
        setInitialPrompt(result.rewrittenPrompt)
      } else if (result.error) {
        setMessages((prev) => [...prev, {
          role: 'system',
          content: `⚠️ Prompt rewrite failed: ${result.error}`,
        }])
      }
    } catch {
      setMessages((prev) => [...prev, {
        role: 'system',
        content: '⚠️ Prompt rewrite failed. Please try again.',
      }])
    }
    setRewritingPrompt(false)
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
    const checkpoint = createCheckpoint(`Before refine: ${userMessage.slice(0, 60)}`)
    if (checkpoint) pendingCheckpointRef.current = checkpoint.timestamp
    const runId = startRun('refine')
    setHealAttempts(0)
    setPreviewError(null)

    const conversationHistory = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    const result = await refineSimulationAction(
      currentCode,
      userMessage,
      currentType,
      images.length > 0 ? images : undefined,
      conversationHistory,
      historySummary
    )

    if (isStaleRun(runId)) return

    pendingCheckpointRef.current = null
    if (checkpoint) persistCheckpoint(checkpoint)

    if (result.success && result.code) {
      setRunStage('Applying updated code...')
      setRunProgress(96)
      const cleaned = cleanCode(result.code)
      setCurrentCode(cleaned)
      setVariables(result.variables || [])
      if (result.historySummary !== undefined) setHistorySummary(result.historySummary)
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
    
    finishRun(runId)
  }
  
  // Manual fix error button
  async function handleFixError() {
    if (!previewError || !currentCode || healing) return

    const runId = startRun('heal')
    setHealing(true)
    const checkpoint = createCheckpoint(`Before auto-fix: ${previewError.slice(0, 60)}`)
    if (checkpoint) pendingCheckpointRef.current = checkpoint.timestamp
    setMessages(prev => [...prev, {
      role: 'system',
      content: `🔧 Attempting to fix: ${previewError.substring(0, 100)}...`
    }])
    
    const result = await healSimulationAction(currentCode, previewError, currentType)

    if (isStaleRun(runId)) return

    pendingCheckpointRef.current = null
    if (checkpoint) persistCheckpoint(checkpoint)
    
    if (result.success && 'code' in result && result.code) {
      setRunStage('Applying auto-fix...')
      setRunProgress(96)
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
    finishRun(runId)
  }
  
  // Handle save
  async function handleSave() {
    if (!saveTitle.trim() || !currentCode) return
    
    setSaving(true)
    
    try {
      // Build version history entry
      const unsavedCheckpointVersions: VersionEntry[] = checkpoints
        .filter((cp) => !cp.persisted)
        .map((cp, idx) => ({
          version: versionHistory.length + idx + 1,
          code: cp.code,
          timestamp: cp.timestamp,
          prompt: `[checkpoint] ${cp.reason}`,
          kind: 'checkpoint',
          type: cp.type,
        }))

      const newVersion: VersionEntry = {
        version: versionHistory.length + unsavedCheckpointVersions.length + 1,
        code: currentCode,
        timestamp: Date.now(),
        prompt: messages.filter(m => m.role === 'user').pop()?.content,
        kind: 'version',
        type: currentType,
      }
      const updatedHistory = [...versionHistory, ...unsavedCheckpointVersions, newVersion]

      const data = {
        title: saveTitle,
        description: saveDescription,
        subject: subject,
        type: 'REACT' as const,
        reactCode: currentCode,
        variables: variables,
        isPublic: savePublic,
        simulationId: isEditing ? initialSimulation!.id : undefined,
        versionHistory: updatedHistory,
        chatHistory: messages,
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
    } catch (error: unknown) {
      alert('Failed to save: ' + (error instanceof Error ? error.message : 'Unknown error'))
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

  const previewSimulation = useMemo(() => {
    if (!currentCode) return null

    return {
      type: currentType,
      reactCode: currentCode,
    }
  }, [currentCode, currentType])
  
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
                    <SelectItem value="IS">🧪 Integrated Science (IS)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Tabs defaultValue="describe">
                <TabsList className="w-full">
                  <TabsTrigger value="describe" className="flex-1">
                    <Sparkles className="h-4 w-4 mr-1.5" />
                    Describe
                  </TabsTrigger>
                  <TabsTrigger value="paste" className="flex-1">
                    <Code className="h-4 w-4 mr-1.5" />
                    Paste Code
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="describe" className="space-y-2 mt-3">
                  <div className="relative">
                    <Textarea
                      placeholder="E.g., Create a car collision simulation where two cars move toward each other. Show momentum conservation with sliders for mass and velocity."
                      value={initialPrompt}
                      onChange={(e) => setInitialPrompt(e.target.value)}
                      onPaste={imageUpload.handlePaste}
                      rows={4}
                      className="resize-none text-base pr-12"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="absolute bottom-2 right-2 h-8 w-8 shadow-sm"
                      onClick={handleRewritePrompt}
                      disabled={!initialPrompt.trim() || rewritingPrompt}
                      title="Rewrite prompt with AI"
                    >
                      {rewritingPrompt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    </Button>
                  </div>
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
                </TabsContent>

                <TabsContent value="paste" className="space-y-3 mt-3">
                  <p className="text-sm text-muted-foreground">
                    Paste React/JSX code generated by ChatGPT, Claude, or any other AI. You can then refine it with follow-up prompts.
                  </p>
                  <Textarea
                    placeholder={`// Paste your React simulation code here\nfunction Simulation() {\n  return <div>...</div>\n}\nexport default Simulation`}
                    value={pastedCode}
                    onChange={(e) => setPastedCode(e.target.value)}
                    rows={8}
                    className="resize-none font-mono text-sm"
                  />
                  <Button
                    onClick={handleLoadCode}
                    disabled={!pastedCode.trim()}
                    className="w-full h-12 text-base"
                    size="lg"
                  >
                    <Code className="mr-2 h-5 w-5" />
                    Load Code into Studio
                  </Button>
                </TabsContent>
              </Tabs>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }
  
  // Chat + Preview Mode
  return (
    <div className="flex h-[calc(100dvh-4rem)] min-h-0 flex-col overflow-hidden md:flex-row">
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
        "w-full min-h-0 border-r bg-muted/30 md:flex md:w-[420px] md:min-w-[340px] md:shrink-0 md:flex-col lg:w-[460px] lg:min-w-[360px]",
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
        
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-3 min-w-0">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[90%] rounded-lg px-3 py-2 text-sm break-words ${
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
                <div className="whitespace-pre-wrap break-words">{msg.content}</div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-4 py-3 space-y-2 text-sm text-muted-foreground w-full max-w-[90%]">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{runStage || 'AI is thinking...'}</span>
                  <span className="ml-auto text-xs">{Math.round(runProgress)}%</span>
                </div>
                <div className="h-1.5 w-full rounded bg-background/60 overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-300" style={{ width: `${Math.max(4, Math.min(100, runProgress))}%` }} />
                </div>
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

        {checkpoints.length > 0 && (
          <div className="px-3 py-2 border-t bg-muted/50">
            <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
              <RotateCcw className="h-3 w-3" />
              Checkpoints ({checkpoints.length})
            </p>
            <div className="space-y-1 max-h-[120px] overflow-y-auto">
              {checkpoints.slice().reverse().map((cp, i) => (
                <div key={cp.timestamp} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground truncate flex-1 mr-2">{cp.reason}</span>
                  <button
                    type="button"
                    onClick={() => restoreCheckpointAt(checkpoints.length - 1 - i)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <form ref={refineFormRef} onSubmit={handleRefine} className="p-3 border-t bg-background">
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
            <Textarea
              ref={refineInputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={imageUpload.handlePaste}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  refineFormRef.current?.requestSubmit()
                }
              }}
              placeholder="E.g., Add a slider for speed..."
              disabled={loading || !currentCode}
              rows={1}
              className="min-h-[40px] max-h-[140px] resize-none text-sm"
            />
            {loading ? (
              <Button type="button" size="icon" variant="destructive" onClick={stopCurrentRun}>
                <X className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" size="icon" disabled={!currentCode || (!input.trim() && imageUpload.pendingImages.length === 0)}>
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </form>
        
        <div className="p-3 border-t space-y-2">
          <div className="flex gap-2">
            <Button onClick={() => setShowSaveDialog(!showSaveDialog)} className="flex-1" variant="outline" size="sm">
              <Save className="mr-2 h-4 w-4" />
              {isEditing ? 'Update' : 'Save to Library'}
            </Button>
            {checkpoints.length > 0 && (
              <Button variant="ghost" size="sm" onClick={restoreLatestCheckpoint} title="Restore latest checkpoint">
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
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
        "flex min-h-0 min-w-0 flex-1 flex-col",
        mobileTab !== 'preview' && "hidden md:flex"
      )}>
        <Tabs defaultValue="preview" className="flex min-h-0 flex-1 flex-col">
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
          
          <TabsContent value="preview" className="m-0 flex min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-4">
            {currentCode ? (
              <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-background p-2 sm:p-3">
                <div className="mx-auto min-h-full w-full max-w-[980px]">
                  <MemoSimulationRunner
                    simulation={previewSimulation}
                    onError={setPreviewError}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>Your simulation preview will appear here</p>
                </div>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="code" className="m-0 flex min-h-0 flex-1 p-3 sm:p-4">
            <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-background p-2 sm:p-3">
              <pre className="mx-auto h-full min-h-0 w-full max-w-[980px] overflow-auto rounded-md bg-muted p-4 font-mono text-xs leading-relaxed">
                <code>{currentCode || 'No code yet'}</code>
              </pre>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
