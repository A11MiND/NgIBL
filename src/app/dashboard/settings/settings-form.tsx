"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Loader2, CheckCircle2, XCircle, Wifi, Lock,
  Sparkles, MessageSquare, BarChart3, Bot, Cpu, Globe, Plus, Trash2, Search, Eye, EyeOff
} from "lucide-react"
import { updateApiKeysAction, testProviderAction, fetchOllamaModelsAction, discoverProviderModelsAction, changePasswordAction } from "./actions"
import { Dictionary } from "@/lib/dictionary"
import {
  PROVIDER_TEMPLATES,
  getTemplateById,
  toProviderConfig,
  type ProviderCategory,
  type ProviderConfig,
} from "@/lib/model-provider-templates"

interface SettingsFormProps {
  currentKeys: {
    hasGeminiApiKey: boolean
    hasDeepseekApiKey: boolean
    hasQwenApiKey: boolean
    ollamaBaseUrl: string | null
    preferredProvider: string | null
    modelProviders: unknown
    deepseekCredits: number
    defaultModel: string | null
    simulationModel: string | null
    chatbotModel: string | null
    analysisModel: string | null
  }
  dict: Dictionary
}

type CurrentKeys = SettingsFormProps["currentKeys"]
type ProviderConfigWithMeta = ProviderConfig & { hasStoredApiKey?: boolean }

function parseProviderConfigs(raw: unknown): ProviderConfigWithMeta[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((item): item is ProviderConfigWithMeta => {
    if (!item || typeof item !== "object") return false
    const rec = item as Record<string, unknown>
    return typeof rec.id === "string" && typeof rec.name === "string"
  }).map((item) => ({
    ...item,
    models: Array.isArray(item.models)
      ? item.models.filter((m): m is string => typeof m === "string").map((m) => m.trim()).filter(Boolean)
      : [],
    enabled: item.enabled !== false,
    hasStoredApiKey: typeof item.apiKey === "string" ? item.apiKey.trim().length > 0 : Boolean(item.hasStoredApiKey),
  }))
}

function uniqueNonEmpty(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values) {
    const v = raw.trim()
    if (!v) continue
    if (seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out
}

function bootstrapProviderConfigs(raw: unknown, currentKeys: CurrentKeys): ProviderConfigWithMeta[] {
  const parsed = parseProviderConfigs(raw)
  const byId = new Map(parsed.map((p) => [p.id, p]))

  const deepseekTemplate = getTemplateById("deepseek")
  const qwenTemplate = getTemplateById("tongyi") || getTemplateById("qwen")
  const geminiTemplate = getTemplateById("google")
  const ollamaTemplate = getTemplateById("ollama")

  const ensure = (id: string, patch: Partial<ProviderConfigWithMeta>, templateId: string) => {
    const existing = byId.get(id)
    if (existing) {
      byId.set(id, {
        ...existing,
        ...patch,
        apiKey: existing.apiKey || patch.apiKey,
        baseUrl: existing.baseUrl || patch.baseUrl,
        hasStoredApiKey: existing.hasStoredApiKey || patch.hasStoredApiKey,
      })
      return
    }
    const t = getTemplateById(templateId)
    if (!t) return
    byId.set(id, {
      ...toProviderConfig(t),
      ...patch,
    })
  }

  if (currentKeys.hasDeepseekApiKey) {
    ensure("deepseek", { name: deepseekTemplate?.name || "DeepSeek", hasStoredApiKey: true, apiKey: "" }, "deepseek")
  }
  if (currentKeys.hasQwenApiKey) {
    const qwenId = qwenTemplate?.id || "qwen"
    ensure(qwenId, { name: qwenTemplate?.name || "Qwen", hasStoredApiKey: true, apiKey: "" }, qwenId)
  }
  if (currentKeys.hasGeminiApiKey) {
    ensure("google", { name: geminiTemplate?.name || "Google Gemini", hasStoredApiKey: true, apiKey: "" }, "google")
  }
  if (currentKeys.ollamaBaseUrl?.trim()) {
    ensure(
      "ollama",
      { name: ollamaTemplate?.name || "Ollama", baseUrl: `${currentKeys.ollamaBaseUrl.replace(/\/+$/, "")}/v1` },
      "ollama"
    )
  }

  return [...byId.values()]
}

function categoryLabel(category: ProviderCategory): string {
  switch (category) {
    case "global":
      return "Global"
    case "china":
      return "China"
    case "aggregator":
      return "Aggregator"
    case "local":
      return "Local / Custom"
    case "special":
      return "Special"
    default:
      return category
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function normalizeProviderKey(input: string): "deepseek" | "qwen" | "gemini" | "ollama" | "openai" | "anthropic" | "azure" | "other" {
  const value = input.toLowerCase()
  if (value.includes("deepseek")) return "deepseek"
  if (value.includes("qwen") || value.includes("tongyi")) return "qwen"
  if (value.includes("gemini") || value.includes("google")) return "gemini"
  if (value.includes("ollama")) return "ollama"
  if (value.includes("openai")) return "openai"
  if (value.includes("anthropic") || value.includes("claude")) return "anthropic"
  if (value.includes("azure")) return "azure"
  return "other"
}

function providerBadgeStyle(input: string): { text: string; className: string } {
  const provider = normalizeProviderKey(input)
  switch (provider) {
    case "deepseek":
      return { text: "DS", className: "bg-blue-50 text-blue-700 border-blue-200" }
    case "qwen":
      return { text: "QW", className: "bg-indigo-50 text-indigo-700 border-indigo-200" }
    case "gemini":
      return { text: "GM", className: "bg-amber-50 text-amber-700 border-amber-200" }
    case "ollama":
      return { text: "OL", className: "bg-emerald-50 text-emerald-700 border-emerald-200" }
    case "openai":
      return { text: "OA", className: "bg-teal-50 text-teal-700 border-teal-200" }
    case "anthropic":
      return { text: "AN", className: "bg-orange-50 text-orange-700 border-orange-200" }
    case "azure":
      return { text: "AZ", className: "bg-cyan-50 text-cyan-700 border-cyan-200" }
    default:
      return { text: "AI", className: "bg-slate-50 text-slate-700 border-slate-200" }
  }
}

function ProviderBadge({ input, compact = false }: { input: string; compact?: boolean }) {
  const badge = providerBadgeStyle(input)
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md border font-semibold ${compact ? "h-5 min-w-5 px-1 text-[10px]" : "h-6 min-w-6 px-1.5 text-[11px]"} ${badge.className}`}
      aria-hidden
    >
      {badge.text}
    </span>
  )
}

const ALL_MODELS: { value: string; label: string; provider: string; vision?: boolean }[] = [
  // DeepSeek
  { value: "deepseek-chat", label: "DeepSeek Chat (V3.2)", provider: "deepseek" },
  { value: "deepseek-reasoner", label: "DeepSeek Reasoner (Thinking)", provider: "deepseek" },
  // Qwen
  { value: "qwen3.5-397b-a17b", label: "Qwen3.5 397B MoE (Flagship)", provider: "qwen" },
  { value: "qwen3-235b-a22b", label: "Qwen3 235B MoE", provider: "qwen" },
  { value: "qwen3-max", label: "Qwen3 Max", provider: "qwen" },
  { value: "qwen-max", label: "Qwen Max (legacy)", provider: "qwen" },
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

function normalizeProviderIdForModels(id: string): string {
  const value = id.toLowerCase()
  if (value === "google") return "gemini"
  if (value === "tongyi") return "qwen"
  return value
}

export default function SettingsForm({ currentKeys, dict }: SettingsFormProps) {
  const [isPending, startTransition] = useTransition()
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string } | null>>({})
  const [testingProvider, setTestingProvider] = useState<string | null>(null)
  const [discoveringProvider, setDiscoveringProvider] = useState<string | null>(null)
  const [discoveryResults, setDiscoveryResults] = useState<Record<string, { success: boolean; message: string } | null>>({})
  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [saved, setSaved] = useState(false)

  // Password change
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordResult, setPasswordResult] = useState<{ success: boolean; message: string } | null>(null)
  const [changingPassword, setChangingPassword] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Form values
  const [ollamaUrl, setOllamaUrl] = useState(currentKeys.ollamaBaseUrl || "http://localhost:11434")
  const [preferredProvider, setPreferredProvider] = useState(currentKeys.preferredProvider || "deepseek")
  const [defaultModel, setDefaultModel] = useState(currentKeys.defaultModel || "")
  const [deepseekCredits, setDeepseekCredits] = useState<number>(currentKeys.deepseekCredits || 200)
  const [providerConfigs, setProviderConfigs] = useState<ProviderConfigWithMeta[]>(() => bootstrapProviderConfigs(currentKeys.modelProviders, currentKeys))
  const [apiKeyTouched, setApiKeyTouched] = useState<Record<string, boolean>>({})
  const [templateToAdd, setTemplateToAdd] = useState<string>("deepseek")
  const [templateSearch, setTemplateSearch] = useState("")
  const [activeSection, setActiveSection] = useState<"models" | "keys" | "security">("models")

  // Per-function models
  const [simulationModel, setSimulationModel] = useState(currentKeys.simulationModel || "")
  const [chatbotModel, setChatbotModel] = useState(currentKeys.chatbotModel || "")
  const [analysisModel, setAnalysisModel] = useState(currentKeys.analysisModel || "")

  const getConfigModels = useCallback((cfg?: ProviderConfig): string[] => {
    if (!cfg) return []
    return uniqueNonEmpty([...(cfg.models || []), cfg.model || ""])
  }, [])

  const getProviderModelOptions = useCallback((providerId: string): { value: string; label: string; provider: string }[] => {
    const normalized = normalizeProviderIdForModels(providerId)
    const cfg = providerConfigs.find((p) => p.id === providerId)
    const configModels = getConfigModels(cfg)

    if (normalized === "ollama") {
      const source = ollamaModels.length > 0 ? ollamaModels : configModels
      return source.map((m) => ({ value: m, label: m, provider: "ollama" }))
    }

    const builtIn = PROVIDER_MODELS[normalized]
    if (builtIn && builtIn.length > 0) {
      const builtInValues = new Set(builtIn.map((m) => m.value))
      const extras = configModels
        .filter((m) => !builtInValues.has(m))
        .map((m) => ({ value: m, label: m, provider: providerId }))
      return [...builtIn, ...extras]
    }

    return configModels.map((m) => ({ value: m, label: m, provider: providerId }))
  }, [getConfigModels, ollamaModels, providerConfigs])

  function handleProviderChange(provider: string) {
    setPreferredProvider(provider)
    const models = getProviderModelOptions(provider)
    const currentModelBelongs = models.some(m => m.value === defaultModel)
    if (!currentModelBelongs) {
      const normalized = normalizeProviderIdForModels(provider)
      setDefaultModel(DEFAULT_MODEL_FOR_PROVIDER[normalized] || models[0]?.value || "")
    }
  }

  async function handleSave() {
    const deepseekCfg = providerConfigs.find((p) => p.id === "deepseek")
    const qwenCfg = providerConfigs.find((p) => p.id === "qwen" || p.id === "tongyi")
    const geminiCfg = providerConfigs.find((p) => p.id === "google" || p.id === "gemini")
    const ollamaCfg = providerConfigs.find((p) => p.id === "ollama")
    const clearApiKeyProviderIds = providerConfigs
      .filter((p) => apiKeyTouched[p.id] && !(p.apiKey?.trim()))
      .map((p) => p.id)

    const serializedProviders: ProviderConfigWithMeta[] = providerConfigs.map((cfg) => ({
      ...cfg,
      hasStoredApiKey: undefined,
    }))

    const getLegacyKeyUpdate = (cfg: ProviderConfigWithMeta | undefined) => {
      if (!cfg) return undefined
      if (!apiKeyTouched[cfg.id]) return undefined
      return cfg.apiKey?.trim() || ""
    }

    startTransition(async () => {
      await updateApiKeysAction({
        geminiKey: getLegacyKeyUpdate(geminiCfg),
        deepseekKey: getLegacyKeyUpdate(deepseekCfg),
        qwenKey: getLegacyKeyUpdate(qwenCfg),
        ollamaUrl: (ollamaCfg?.baseUrl || "").replace(/\/+$/, "").replace(/\/v1$/, "") || "",
        preferredProvider,
        defaultModel,
        simulationModel,
        chatbotModel,
        analysisModel,
        modelProviders: serializedProviders,
        clearApiKeyProviderIds,
        deepseekCredits,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    })
  }

  function handleAddTemplate() {
    const template = getTemplateById(templateToAdd)
    if (!template) return
    setProviderConfigs((prev) => {
      if (prev.some((p) => p.id === template.id)) return prev
      return [...prev, toProviderConfig(template)]
    })
  }

  function handleProviderConfigChange(id: string, patch: Partial<ProviderConfigWithMeta>) {
    setProviderConfigs((prev) => prev.map((p) => {
      if (p.id !== id) return p

      const next: ProviderConfigWithMeta = { ...p, ...patch }

      if (typeof patch.model === "string") {
        next.models = uniqueNonEmpty([patch.model, ...(p.models || [])])
      }
      if (Array.isArray(patch.models)) {
        next.models = uniqueNonEmpty(patch.models)
      }
      if (typeof patch.apiKey === "string") {
        next.hasStoredApiKey = patch.apiKey.trim().length > 0
      }

      return next
    }))

    if (id === "ollama" && typeof patch.baseUrl === "string") {
      setOllamaUrl(patch.baseUrl.replace(/\/+$/, "").replace(/\/v1$/, ""))
    }
  }

  function handleRemoveProviderConfig(id: string) {
    setProviderConfigs((prev) => prev.filter((p) => p.id !== id))
  }

  function providerNeedsApiKey(cfg: ProviderConfig): boolean {
    return cfg.category !== "local"
  }

  function hasApiKeyConfigured(cfg: ProviderConfigWithMeta): boolean {
    return Boolean(cfg.apiKey?.trim()) || Boolean(cfg.hasStoredApiKey)
  }

  function providerIsReady(cfg: ProviderConfigWithMeta): boolean {
    if (!cfg.enabled) return false
    if (!providerNeedsApiKey(cfg)) return true
    return hasApiKeyConfigured(cfg)
  }

  async function handleFetchOllamaModels() {
    setLoadingModels(true)
    try {
      const result = await fetchOllamaModelsAction(ollamaUrl)
      if (result.success && result.models) {
        const discovered = uniqueNonEmpty(result.models)
        setOllamaModels(discovered)
        setProviderConfigs((prev) => prev.map((p) => {
          if (p.id !== "ollama") return p
          return {
            ...p,
            models: uniqueNonEmpty([...(p.models || []), ...discovered]),
            model: p.model?.trim() || discovered[0] || p.model,
          }
        }))
      }
    } catch {}
    setLoadingModels(false)
  }

  async function handleDiscoverProviderModels(cfg: ProviderConfig) {
    setDiscoveringProvider(cfg.id)
    try {
      const result = await discoverProviderModelsAction({
        id: cfg.id,
        category: cfg.category,
        apiKey: cfg.apiKey,
        baseUrl: cfg.baseUrl,
      })

      if (!result.success || !result.models) {
        setDiscoveryResults((prev) => ({
          ...prev,
          [cfg.id]: { success: false, message: result.message || "No models found." },
        }))
        return
      }

      const discovered = uniqueNonEmpty(result.models)

      setProviderConfigs((prev) => prev.map((p) => {
        if (p.id !== cfg.id) return p
        const mergedModels = uniqueNonEmpty([...(p.models || []), ...discovered])
        const nextModel = p.model?.trim() || mergedModels[0] || ""
        return {
          ...p,
          models: mergedModels,
          model: nextModel,
        }
      }))

      if (cfg.id === "ollama") {
        setOllamaModels(discovered)
      }

      setDiscoveryResults((prev) => ({
        ...prev,
        [cfg.id]: { success: true, message: `Discovered ${discovered.length} model(s).` },
      }))
    } catch (error: unknown) {
      setDiscoveryResults((prev) => ({
        ...prev,
        [cfg.id]: { success: false, message: getErrorMessage(error, "Discover failed") },
      }))
    }
    setDiscoveringProvider(null)
  }

  async function handleChangePassword() {
    if (newPassword !== confirmPassword) {
      setPasswordResult({ success: false, message: "New passwords do not match." })
      return
    }
    if (currentPassword && newPassword && currentPassword === newPassword) {
      setPasswordResult({ success: false, message: "New password must be different from current password." })
      return
    }
    if (newPassword.length < 6) {
      setPasswordResult({ success: false, message: "New password must be at least 6 characters." })
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
    } catch (error: unknown) {
      setPasswordResult({ success: false, message: getErrorMessage(error, "Failed to change password") })
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

  const renderDiscoveryResult = (provider: string) => {
    const result = discoveryResults[provider]
    if (!result) return null
    return (
      <p className={`text-xs flex items-center gap-1 mt-1 ${result.success ? 'text-green-600' : 'text-amber-600'}`}>
        {result.success ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
        {result.message.substring(0, 120)}
      </p>
    )
  }

  const passwordMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword
  const sameAsCurrentPassword = currentPassword.length > 0 && newPassword.length > 0 && currentPassword === newPassword
  const passwordTooShort = newPassword.length > 0 && newPassword.length < 6

  // Build full model list including dynamic provider models.
  const allModelMap = new Map<string, { value: string; label: string; provider: string }>()
  for (const m of ALL_MODELS) {
    allModelMap.set(`${m.provider}:${m.value}`, { value: m.value, label: m.label, provider: m.provider })
  }
  for (const cfg of providerConfigs) {
    for (const modelId of getConfigModels(cfg)) {
      const key = `${cfg.id}:${modelId}`
      if (!allModelMap.has(key)) {
        allModelMap.set(key, {
          value: modelId,
          label: `${cfg.name}: ${modelId}`,
          provider: cfg.id,
        })
      }
    }
  }
  for (const modelId of ollamaModels) {
    allModelMap.set(`ollama:${modelId}`, { value: modelId, label: `Ollama: ${modelId}`, provider: "ollama" })
  }
  const allModelOptions = [...allModelMap.values()]

  const configuredProviders = providerConfigs
  const selectableProviders = configuredProviders.filter((cfg) => cfg.enabled)
  const safeSelectableProviders = selectableProviders.length > 0 ? selectableProviders : configuredProviders
  const readyProviders = configuredProviders.filter(providerIsReady)
  const notReadyProviders = configuredProviders.filter((cfg) => !providerIsReady(cfg))
  const installedProviderIds = new Set(configuredProviders.map((cfg) => cfg.id))
  const installableTemplates = PROVIDER_TEMPLATES.filter((template) => {
    if (installedProviderIds.has(template.id)) return false
    const q = templateSearch.trim().toLowerCase()
    if (!q) return true
    return (
      template.name.toLowerCase().includes(q)
      || template.category.toLowerCase().includes(q)
      || template.id.toLowerCase().includes(q)
    )
  })

  async function handleTestConfig(cfg: ProviderConfig) {
    setTestingProvider(cfg.id)
    try {
      const result = await testProviderAction({
        id: cfg.id,
        category: cfg.category,
        apiKey: cfg.apiKey,
        baseUrl: cfg.baseUrl,
        model: cfg.model,
      })
      setTestResults((prev) => ({ ...prev, [cfg.id]: result }))
    } catch (error: unknown) {
      setTestResults((prev) => ({
        ...prev,
        [cfg.id]: { success: false, message: getErrorMessage(error, "Test failed") },
      }))
    }
    setTestingProvider(null)
  }

  useEffect(() => {
    if (safeSelectableProviders.length === 0) return

    const hasPreferred = safeSelectableProviders.some((cfg) => cfg.id === preferredProvider)
    if (!hasPreferred) {
      setPreferredProvider(safeSelectableProviders[0].id)
    }
  }, [preferredProvider, safeSelectableProviders])

  useEffect(() => {
    if (!preferredProvider) return
    const options = getProviderModelOptions(preferredProvider)
    if (options.length === 0) {
      if (defaultModel) setDefaultModel("")
      return
    }

    const exists = options.some((opt) => opt.value === defaultModel)
    if (!exists) {
      const normalized = normalizeProviderIdForModels(preferredProvider)
      setDefaultModel(DEFAULT_MODEL_FOR_PROVIDER[normalized] || options[0]?.value || "")
    }
  }, [defaultModel, preferredProvider, getProviderModelOptions])

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
              <SelectItem key={`${m.provider}:${m.value}`} value={m.value}>
                <div className="flex items-center gap-2">
                  <ProviderBadge input={m.provider} compact />
                  <span>{m.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{dict.nav.settings}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-6">
        <aside className="h-fit lg:sticky lg:top-20">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Settings</CardTitle>
              <CardDescription className="text-xs">Section Navigation</CardDescription>
            </CardHeader>
            <CardContent className="p-2 space-y-1">
              {[
                { id: "models" as const, label: "Models", icon: <Cpu className="h-4 w-4" /> },
                { id: "keys" as const, label: "API Keys & Providers", icon: <Globe className="h-4 w-4" /> },
                { id: "security" as const, label: "Change Password", icon: <Lock className="h-4 w-4" /> },
              ].map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full text-left rounded-md px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                    activeSection === section.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-foreground"
                  }`}
                >
                  {section.icon}
                  <span>{section.label}</span>
                </button>
              ))}
            </CardContent>
          </Card>
        </aside>

        <div className="space-y-6">

          {activeSection === "models" && (
            <>
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
                          {safeSelectableProviders.map((cfg) => (
                            <SelectItem key={cfg.id} value={cfg.id}>
                              <div className="flex items-center gap-2">
                                <ProviderBadge input={cfg.id} compact />
                                <span>{cfg.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Default Model</Label>
                      {getProviderModelOptions(preferredProvider).length > 0 ? (
                        <Select value={defaultModel} onValueChange={setDefaultModel}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select model..." />
                          </SelectTrigger>
                          <SelectContent>
                            {getProviderModelOptions(preferredProvider).map((m) => (
                              <SelectItem key={m.value} value={m.value}>
                                <div className="flex items-center gap-2">
                                  <ProviderBadge input={m.provider} compact />
                                  <span>{m.label}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : normalizeProviderIdForModels(preferredProvider) === "ollama" ? (
                        <p className="text-xs text-muted-foreground pt-2">Fetch Ollama models below first.</p>
                      ) : (
                        <p className="text-xs text-muted-foreground pt-2">No model configured for this provider yet. Add a model in API Keys & Providers.</p>
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
            </>
          )}

          {/* API Keys + Provider List */}
          {activeSection === "keys" && <Card>
        <CardHeader className="pb-3">
          <CardTitle>API Keys</CardTitle>
          <CardDescription>
            Top: configure existing provider API keys/models. Bottom: click + to add new provider keys.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="text-sm font-semibold mb-3">Configured Keys</p>
            {configuredProviders.length === 0 ? (
              <div className="border rounded-xl p-4 bg-muted/20">
                <p className="text-sm text-muted-foreground">No API providers configured yet. Add one below.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {[...notReadyProviders, ...readyProviders].map((cfg) => (
                  <div key={cfg.id} className="border rounded-xl p-3 space-y-3 bg-background">
                    {(() => {
                      const providerModels = getConfigModels(cfg)
                      return (
                        <>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold flex items-center gap-2">
                          <ProviderBadge input={cfg.id} compact />
                          <span>{cfg.name}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{categoryLabel(cfg.category)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {providerNeedsApiKey(cfg) && !hasApiKeyConfigured(cfg) ? (
                          <span className="text-xs rounded-md bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1">API key required</span>
                        ) : (
                          <span className="text-xs rounded-md bg-green-50 text-green-700 border border-green-200 px-2 py-1">Ready</span>
                        )}
                        <Button
                          type="button"
                          variant={cfg.enabled ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => handleProviderConfigChange(cfg.id, { enabled: !cfg.enabled })}
                        >
                          {cfg.enabled ? "Enabled" : "Disabled"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDiscoverProviderModels(cfg)}
                          disabled={discoveringProvider === cfg.id}
                        >
                          {discoveringProvider === cfg.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                          <span className="ml-1">Discover</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestConfig(cfg)}
                          disabled={testingProvider === cfg.id}
                        >
                          {testingProvider === cfg.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                          <span className="ml-1">Test</span>
                        </Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveProviderConfig(cfg.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <Input
                        type="password"
                        placeholder={cfg.hasStoredApiKey ? "Stored key configured (type to replace, clear to remove)" : "Set API key"}
                        value={cfg.apiKey || ""}
                        onChange={(e) => {
                          setApiKeyTouched((prev) => ({ ...prev, [cfg.id]: true }))
                          handleProviderConfigChange(cfg.id, { apiKey: e.target.value })
                        }}
                      />
                      <Input
                        placeholder="Default model (manual)"
                        value={cfg.model || ""}
                        onChange={(e) => handleProviderConfigChange(cfg.id, { model: e.target.value })}
                      />
                      <Input
                        placeholder="Base URL"
                        value={cfg.baseUrl || ""}
                        onChange={(e) => handleProviderConfigChange(cfg.id, { baseUrl: e.target.value })}
                      />
                    </div>
                    {providerModels.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_220px] gap-2 items-center">
                        <p className="text-xs text-muted-foreground">Discovered / saved models: {providerModels.length}</p>
                        <Select
                          value={cfg.model || providerModels[0]}
                          onValueChange={(value) => handleProviderConfigChange(cfg.id, { model: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pick default model" />
                          </SelectTrigger>
                          <SelectContent>
                            {providerModels.map((m) => (
                              <SelectItem key={`${cfg.id}:${m}`} value={m}>{m}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {renderTestResult(cfg.id)}
                    {renderDiscoveryResult(cfg.id)}
                    {cfg.id === "ollama" && (
                      <div className="flex items-center gap-2 pt-1">
                        <Label className="text-xs">Local Models</Label>
                        <Button type="button" variant="ghost" size="sm" onClick={handleFetchOllamaModels} disabled={loadingModels}>
                          {loadingModels ? <Loader2 className="h-3 w-3 animate-spin" /> : "Refresh"}
                        </Button>
                        {ollamaModels.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {ollamaModels.map((m) => (
                              <span key={m} className="text-xs bg-muted px-2 py-0.5 rounded-full">{m}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                        </>
                      )
                    })()}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">Add API Key (+)</p>
              <div className="relative w-56 max-w-full">
                <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  placeholder="Search provider"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={templateToAdd} onValueChange={setTemplateToAdd}>
                <SelectTrigger className="sm:flex-1">
                  <SelectValue placeholder="Choose provider template" />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_TEMPLATES.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name} ({categoryLabel(template.category)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" onClick={handleAddTemplate}>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>

            <div className="space-y-2">
              {installableTemplates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No more providers match this search.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {installableTemplates.map((template) => (
                    <div key={template.id} className="border rounded-xl p-3 bg-background space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold flex items-center gap-2">
                            <ProviderBadge input={template.id} compact />
                            <span>{template.name}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">{categoryLabel(template.category)}</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setTemplateToAdd(template.id)
                            const picked = getTemplateById(template.id)
                            if (!picked) return
                            setProviderConfigs((prev) => {
                              if (prev.some((p) => p.id === picked.id)) return prev
                              return [...prev, toProviderConfig(picked)]
                            })
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{template.notes || `Default model: ${template.defaultModel || "custom"}`}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="border rounded-xl p-4 bg-muted/30 space-y-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground">AI CREDITS</p>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-2xl font-semibold leading-none">{deepseekCredits}</div>
              <div className="w-full sm:w-52">
                <Input
                  type="number"
                  min={0}
                  value={deepseekCredits}
                  onChange={(e) => setDeepseekCredits(Number(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>
        </CardContent>
          </Card>}

          {/* Change Password */}
          {activeSection === "security" && <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <div className="relative">
              <Input
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                className="pr-10"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-2 my-auto h-7 w-7 inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                onClick={() => setShowCurrentPassword((v) => !v)}
                aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
              >
                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min 6 chars)"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-2 my-auto h-7 w-7 inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                  onClick={() => setShowNewPassword((v) => !v)}
                  aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-2 my-auto h-7 w-7 inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          {passwordResult && (
            <p className={`text-xs flex items-center gap-1 ${passwordResult.success ? 'text-green-600' : 'text-red-600'}`}>
              {passwordResult.success ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
              {passwordResult.message}
            </p>
          )}
          {(passwordMismatch || sameAsCurrentPassword || passwordTooShort) && (
            <div className="space-y-1 text-xs text-amber-600">
              {passwordMismatch && <p>New password and confirm password must match.</p>}
              {sameAsCurrentPassword && <p>New password should be different from current password.</p>}
              {passwordTooShort && <p>New password must be at least 6 characters.</p>}
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleChangePassword}
            disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword || passwordMismatch || sameAsCurrentPassword || passwordTooShort}
          >
            {changingPassword ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Changing...</> : "Change Password"}
          </Button>
        </CardContent>
          </Card>}
        </div>
      </div>

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
