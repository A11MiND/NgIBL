"use client"

import { useState, useTransition } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Loader2, CheckCircle2, XCircle, Wifi, Lock, ChevronDown, ChevronRight,
  Sparkles, MessageSquare, BarChart3, Bot, Cpu, Globe, Server
} from "lucide-react"
import { updateApiKeysAction, testProviderAction, fetchOllamaModelsAction, changePasswordAction } from "./actions"
import { Dictionary } from "@/lib/dictionary"

interface SettingsFormProps {
  currentKeys: {
    geminiApiKey: string | null
    deepseekApiKey: string | null
    qwenApiKey: string | null
    ollamaBaseUrl: string | null
    preferredProvider: string | null
    defaultModel: string | null
    simulationModel: string | null
    chatbotModel: string | null
    analysisModel: string | null
  }
  dict: Dictionary
}

const ALL_MODELS: { value: string; label: string; provider: string; vision?: boolean }[] = [
  // DeepSeek
  { value: "deepseek-chat", label: "DeepSeek Chat (V3.2)", provider: "deepseek" },
  { value: "deepseek-reasoner", label: "DeepSeek Reasoner (Thinking)", provider: "deepseek" },
  // Qwen
  { value: "qwen-max", label: "Qwen3 Max", provider: "qwen" },
  { value: "qwen-plus", label: "Qwen Plus (1M ctx)", provider: "qwen" },
  { value: "qwen-turbo", label: "Qwen Flash (1M ctx)", provider: "qwen" },
  { value: "qwen3-vl-plus", label: "Qwen3 VL Plus (Vision)", provider: "qwen", vision: true },
  { value: "qwen3-vl-flash", label: "Qwen3 VL Flash (Vision)", provider: "qwen", vision: true },
  { value: "qwen3-omni-flash", label: "Qwen3 Omni Flash", provider: "qwen" },
  // Gemini
  { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash", provider: "gemini" },
  { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro", provider: "gemini" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash", provider: "gemini" },
]

const PROVIDER_MODELS: Record<string, { value: string; label: string }[]> = {
  deepseek: ALL_MODELS.filter(m => m.provider === "deepseek"),
  qwen: ALL_MODELS.filter(m => m.provider === "qwen"),
  gemini: ALL_MODELS.filter(m => m.provider === "gemini"),
  ollama: [],
}

const DEFAULT_MODEL_FOR_PROVIDER: Record<string, string> = {
  deepseek: "deepseek-chat",
  qwen: "qwen-plus",
  gemini: "gemini-1.5-flash",
  ollama: "",
}

function maskKey(key: string | null) {
  if (!key) return ""
  if (key.length < 8) return "••••••••"
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`
}

// Collapsible section component
function CollapsibleSection({ 
  icon, title, description, children, defaultOpen = false 
}: { 
  icon: React.ReactNode; title: string; description?: string; children: React.ReactNode; defaultOpen?: boolean 
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="shrink-0 text-muted-foreground">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">{title}</div>
          {description && <div className="text-xs text-muted-foreground truncate">{description}</div>}
        </div>
        {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-3 border-t pt-3">{children}</div>}
    </div>
  )
}

export default function SettingsForm({ currentKeys, dict }: SettingsFormProps) {
  const [isPending, startTransition] = useTransition()
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string } | null>>({})
  const [testingProvider, setTestingProvider] = useState<string | null>(null)
  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [saved, setSaved] = useState(false)

  // Password change
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordResult, setPasswordResult] = useState<{ success: boolean; message: string } | null>(null)
  const [changingPassword, setChangingPassword] = useState(false)

  // Form values
  const [geminiKey, setGeminiKey] = useState("")
  const [deepseekKey, setDeepseekKey] = useState("")
  const [qwenKey, setQwenKey] = useState("")
  const [ollamaUrl, setOllamaUrl] = useState(currentKeys.ollamaBaseUrl || "http://localhost:11434")
  const [preferredProvider, setPreferredProvider] = useState(currentKeys.preferredProvider || "deepseek")
  const [defaultModel, setDefaultModel] = useState(currentKeys.defaultModel || "")

  // Per-function models
  const [simulationModel, setSimulationModel] = useState(currentKeys.simulationModel || "")
  const [chatbotModel, setChatbotModel] = useState(currentKeys.chatbotModel || "")
  const [analysisModel, setAnalysisModel] = useState(currentKeys.analysisModel || "")

  function handleProviderChange(provider: string) {
    setPreferredProvider(provider)
    const models = provider === "ollama" ? ollamaModels.map(m => ({ value: m, label: m })) : (PROVIDER_MODELS[provider] || [])
    const currentModelBelongs = models.some(m => m.value === defaultModel)
    if (!currentModelBelongs) {
      setDefaultModel(DEFAULT_MODEL_FOR_PROVIDER[provider] || models[0]?.value || "")
    }
  }

  async function handleSave() {
    startTransition(async () => {
      await updateApiKeysAction({
        geminiKey,
        deepseekKey,
        qwenKey,
        ollamaUrl,
        preferredProvider,
        defaultModel,
        simulationModel,
        chatbotModel,
        analysisModel,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    })
  }

  async function handleTest(provider: string) {
    setTestingProvider(provider)
    try {
      const result = await testProviderAction(provider)
      setTestResults(prev => ({ ...prev, [provider]: result }))
    } catch (error: any) {
      setTestResults(prev => ({ ...prev, [provider]: { success: false, message: error.message } }))
    }
    setTestingProvider(null)
  }

  async function handleFetchOllamaModels() {
    setLoadingModels(true)
    try {
      const result = await fetchOllamaModelsAction(ollamaUrl)
      if (result.success && result.models) {
        setOllamaModels(result.models)
      }
    } catch {}
    setLoadingModels(false)
  }

  async function handleChangePassword() {
    if (newPassword !== confirmPassword) {
      setPasswordResult({ success: false, message: "New passwords do not match." })
      return
    }
    setChangingPassword(true)
    setPasswordResult(null)
    try {
      const result = await changePasswordAction({ currentPassword, newPassword })
      setPasswordResult(result)
      if (result.success) {
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
      }
    } catch (error: any) {
      setPasswordResult({ success: false, message: error.message })
    }
    setChangingPassword(false)
  }

  const renderTestResult = (provider: string) => {
    const result = testResults[provider]
    if (!result) return null
    return (
      <p className={`text-xs flex items-center gap-1 mt-1 ${result.success ? 'text-green-600' : 'text-red-600'}`}>
        {result.success ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
        {result.message.substring(0, 100)}
      </p>
    )
  }

  // Build full model list including ollama
  const allModelOptions = [
    ...ALL_MODELS,
    ...ollamaModels.map(m => ({ value: m, label: `Ollama: ${m}`, provider: "ollama" })),
  ]

  // Per-function model picker
  const FunctionModelPicker = ({ 
    label, description, icon, value, onChange 
  }: { 
    label: string; description: string; icon: React.ReactNode; value: string; onChange: (v: string) => void 
  }) => (
    <div className="flex items-start gap-3 p-3 border rounded-lg">
      <div className="shrink-0 mt-0.5 text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
        <Select value={value || "__default__"} onValueChange={(v) => onChange(v === "__default__" ? "" : v)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Use default model" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__default__">Use default model</SelectItem>
            {allModelOptions.map(m => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{dict.nav.settings}</h1>

      {/* Default Provider & Model */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            Default AI Provider
          </CardTitle>
          <CardDescription>
            Choose the default AI provider and model used across all functions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={preferredProvider} onValueChange={handleProviderChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deepseek">DeepSeek</SelectItem>
                  <SelectItem value="qwen">Qwen (Alibaba Cloud)</SelectItem>
                  <SelectItem value="gemini">Google Gemini</SelectItem>
                  <SelectItem value="ollama">Ollama (Local)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Default Model</Label>
              {preferredProvider === "ollama" ? (
                ollamaModels.length > 0 ? (
                  <Select value={defaultModel} onValueChange={setDefaultModel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select model..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ollamaModels.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-xs text-muted-foreground pt-2">Fetch Ollama models below first.</p>
                )
              ) : (
                <Select value={defaultModel} onValueChange={setDefaultModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select model..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(PROVIDER_MODELS[preferredProvider] || []).map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-Function Model Override */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Per-Function Model Override
          </CardTitle>
          <CardDescription>
            Optionally pick a different model for each function. Leave as &quot;Use default&quot; to use the provider model above.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <FunctionModelPicker
            label="Simulation Generation"
            description="Model used when AI creates interactive simulations in Sandbox"
            icon={<Sparkles className="h-4 w-4" />}
            value={simulationModel}
            onChange={setSimulationModel}
          />
          <FunctionModelPicker
            label="Student AI Chatbot"
            description="Model used for the AI tutor chatbot in experiments"
            icon={<MessageSquare className="h-4 w-4" />}
            value={chatbotModel}
            onChange={setChatbotModel}
          />
          <FunctionModelPicker
            label="Student Analysis"
            description="Model used for analysing student submissions and generating insights"
            icon={<BarChart3 className="h-4 w-4" />}
            value={analysisModel}
            onChange={setAnalysisModel}
          />
        </CardContent>
      </Card>

      {/* API Keys - Collapsible */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>API Keys</CardTitle>
          <CardDescription>Configure API keys for each provider. Click to expand.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <CollapsibleSection
            icon={<Globe className="h-4 w-4" />}
            title="DeepSeek"
            description={currentKeys.deepseekApiKey ? `Key: ${maskKey(currentKeys.deepseekApiKey)}` : "Not configured"}
          >
            <div className="flex gap-2">
              <Input
                type="password"
                value={deepseekKey}
                onChange={(e) => setDeepseekKey(e.target.value)}
                placeholder={currentKeys.deepseekApiKey ? "Leave blank to keep current" : "sk-..."}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleTest("deepseek")}
                disabled={testingProvider === "deepseek"}
                className="shrink-0"
              >
                {testingProvider === "deepseek" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                <span className="ml-1">Test</span>
              </Button>
            </div>
            {currentKeys.deepseekApiKey && <p className="text-xs text-green-600">✓ Key saved</p>}
            {renderTestResult("deepseek")}
          </CollapsibleSection>

          <CollapsibleSection
            icon={<Globe className="h-4 w-4" />}
            title="Qwen (Alibaba Cloud / DashScope)"
            description={currentKeys.qwenApiKey ? `Key: ${maskKey(currentKeys.qwenApiKey)}` : "Not configured"}
          >
            <div className="flex gap-2">
              <Input
                type="password"
                value={qwenKey}
                onChange={(e) => setQwenKey(e.target.value)}
                placeholder={currentKeys.qwenApiKey ? "Leave blank to keep current" : "sk-..."}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleTest("qwen")}
                disabled={testingProvider === "qwen"}
                className="shrink-0"
              >
                {testingProvider === "qwen" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                <span className="ml-1">Test</span>
              </Button>
            </div>
            {currentKeys.qwenApiKey && <p className="text-xs text-green-600">✓ Key saved</p>}
            {renderTestResult("qwen")}
          </CollapsibleSection>

          <CollapsibleSection
            icon={<Globe className="h-4 w-4" />}
            title="Google Gemini"
            description={currentKeys.geminiApiKey ? `Key: ${maskKey(currentKeys.geminiApiKey)}` : "Not configured"}
          >
            <div className="flex gap-2">
              <Input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder={currentKeys.geminiApiKey ? "Leave blank to keep current" : "AIza..."}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleTest("gemini")}
                disabled={testingProvider === "gemini"}
                className="shrink-0"
              >
                {testingProvider === "gemini" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                <span className="ml-1">Test</span>
              </Button>
            </div>
            {currentKeys.geminiApiKey && <p className="text-xs text-green-600">✓ Key saved</p>}
            {renderTestResult("gemini")}
          </CollapsibleSection>

          <CollapsibleSection
            icon={<Server className="h-4 w-4" />}
            title="Ollama (Local)"
            description={currentKeys.ollamaBaseUrl || "http://localhost:11434"}
          >
            <div className="flex gap-2">
              <Input
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                placeholder="http://localhost:11434"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleTest("ollama")}
                disabled={testingProvider === "ollama"}
                className="shrink-0"
              >
                {testingProvider === "ollama" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                <span className="ml-1">Test</span>
              </Button>
            </div>
            {renderTestResult("ollama")}
            <div className="flex items-center gap-2 pt-2">
              <Label className="text-xs">Models</Label>
              <Button type="button" variant="ghost" size="sm" onClick={handleFetchOllamaModels} disabled={loadingModels}>
                {loadingModels ? <Loader2 className="h-3 w-3 animate-spin" /> : "Refresh"}
              </Button>
            </div>
            {ollamaModels.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {ollamaModels.map(m => (
                  <span key={m} className="text-xs bg-muted px-2 py-0.5 rounded-full">{m}</span>
                ))}
              </div>
            )}
          </CollapsibleSection>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 6 chars)"
              />
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
          </div>
          {passwordResult && (
            <p className={`text-xs flex items-center gap-1 ${passwordResult.success ? 'text-green-600' : 'text-red-600'}`}>
              {passwordResult.success ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
              {passwordResult.message}
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleChangePassword}
            disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
          >
            {changingPassword ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Changing...</> : "Change Password"}
          </Button>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end gap-3 pb-8">
        {saved && (
          <p className="text-sm text-green-600 flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4" /> Saved!
          </p>
        )}
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : "Save Changes"}
        </Button>
      </div>
    </div>
  )
}
