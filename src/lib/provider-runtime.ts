import { AIProvider, inferProviderFromModel } from '@/lib/ai'
import type { ProviderCategory, ProviderConfig } from '@/lib/model-provider-templates'

type ProviderUserLike = {
  preferredProvider?: string | null
  defaultModel?: string | null
  deepseekApiKey?: string | null
  qwenApiKey?: string | null
  geminiApiKey?: string | null
  ollamaBaseUrl?: string | null
  modelProviders?: unknown
  [key: string]: unknown
}

export type ProviderRuntime = {
  apiKey: string
  provider: AIProvider
  model?: string
  ollamaBaseUrl?: string
  baseUrl?: string
  providerId?: string
  providerCategory?: ProviderCategory
  source: 'modelProviders' | 'legacy'
}

export function providerRuntimeNeedsApiKey(runtime: Pick<ProviderRuntime, 'provider' | 'source' | 'providerCategory'>): boolean {
  if (runtime.provider === 'ollama') return false
  if (runtime.source === 'modelProviders' && runtime.providerCategory === 'local') return false
  return true
}

function parseModelProviders(raw: unknown): ProviderConfig[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((item): item is ProviderConfig => {
    if (!item || typeof item !== 'object') return false
    const rec = item as Record<string, unknown>
    return typeof rec.id === 'string' && typeof rec.name === 'string'
  }).map((item) => ({ ...item, enabled: item.enabled !== false }))
}

function isReady(cfg: ProviderConfig): boolean {
  if (!cfg.enabled) return false
  if (cfg.category === 'local') return true
  return Boolean(cfg.apiKey?.trim())
}

function stripV1Suffix(url: string): string {
  return url.replace(/\/+$/, '').replace(/\/v1$/, '')
}

function getModelHints(model: string): string[] {
  const m = model.toLowerCase()
  if (m.startsWith('gpt') || m.includes('openai/')) return ['openai', 'openrouter', 'azure-openai', 'openai-compatible']
  if (m.startsWith('claude')) return ['anthropic', 'openrouter']
  if (m.startsWith('gemini')) return ['google']
  if (m.startsWith('qwen')) return ['qwen', 'tongyi', 'openrouter', 'siliconflow']
  if (m.startsWith('deepseek')) return ['deepseek', 'openrouter']
  if (m.includes(':')) return ['ollama', 'openai-compatible', 'localai', 'xinference']
  return []
}

function configToRuntime(cfg: ProviderConfig, fallbackModel?: string): ProviderRuntime | null {
  const id = cfg.id.toLowerCase()
  const configModel = cfg.model?.trim() || undefined
  const model = fallbackModel || configModel

  // Native providers
  if (id === 'deepseek') {
    const apiKey = cfg.apiKey?.trim()
    if (!apiKey) return null
    return {
      apiKey,
      provider: 'deepseek',
      model,
      baseUrl: cfg.baseUrl?.trim() || undefined,
      providerId: cfg.id,
      providerCategory: cfg.category,
      source: 'modelProviders',
    }
  }

  if (id === 'qwen' || id === 'tongyi') {
    const apiKey = cfg.apiKey?.trim()
    if (!apiKey) return null
    return {
      apiKey,
      provider: 'qwen',
      model,
      baseUrl: cfg.baseUrl?.trim() || undefined,
      providerId: cfg.id,
      providerCategory: cfg.category,
      source: 'modelProviders',
    }
  }

  if (id === 'google' || id === 'gemini') {
    const apiKey = cfg.apiKey?.trim()
    if (!apiKey) return null
    return {
      apiKey,
      provider: 'gemini',
      model,
      providerId: cfg.id,
      providerCategory: cfg.category,
      source: 'modelProviders',
    }
  }

  if (id === 'ollama') {
    const ollamaBaseUrl = stripV1Suffix((cfg.baseUrl || 'http://localhost:11434').trim())
    return {
      apiKey: '',
      provider: 'ollama',
      model,
      ollamaBaseUrl,
      providerId: cfg.id,
      providerCategory: cfg.category,
      source: 'modelProviders',
    }
  }

  // OpenAI-compatible dynamic providers route through existing OpenAI-compatible path.
  // This lets users use providers configured in Model Provider even without legacy API key fields.
  if (cfg.baseUrl?.trim() && (cfg.apiKey?.trim() || cfg.category === 'local')) {
    return {
      apiKey: cfg.apiKey?.trim() || '',
      provider: 'deepseek',
      model,
      baseUrl: cfg.baseUrl.trim(),
      providerId: cfg.id,
      providerCategory: cfg.category,
      source: 'modelProviders',
    }
  }

  return null
}

export function resolveProviderRuntime(params: {
  user: ProviderUserLike
  functionField?: string
  explicitModel?: string
  disableModelProviders?: boolean
}): ProviderRuntime {
  const { user, functionField, explicitModel, disableModelProviders } = params

  const functionModel = functionField ? user[functionField] : undefined
  const model = explicitModel
    || (typeof functionModel === 'string' ? functionModel : undefined)
    || user.defaultModel
    || undefined

  if (!disableModelProviders) {
    const configs = parseModelProviders(user.modelProviders)
    const enabled = configs.filter(isReady)

    if (enabled.length > 0) {
      const candidates: ProviderConfig[] = []
      const seen = new Set<string>()
      const pushCandidate = (cfg?: ProviderConfig) => {
        if (!cfg) return
        if (seen.has(cfg.id)) return
        seen.add(cfg.id)
        candidates.push(cfg)
      }

      const inferred = model ? inferProviderFromModel(model) : null
      if (inferred) {
        const inferredMap: Record<AIProvider, string[]> = {
          deepseek: ['deepseek'],
          qwen: ['qwen', 'tongyi'],
          gemini: ['google', 'gemini'],
          ollama: ['ollama'],
        }
        for (const id of inferredMap[inferred] || []) {
          pushCandidate(enabled.find((cfg) => cfg.id === id))
        }
      }

      if (model) {
        for (const id of getModelHints(model)) {
          pushCandidate(enabled.find((cfg) => cfg.id === id))
        }
      }

      if (user.preferredProvider) {
        const preferred = user.preferredProvider.toLowerCase()
        pushCandidate(enabled.find((cfg) => cfg.id === preferred))
      }

      for (const cfg of enabled) pushCandidate(cfg)

      for (const cfg of candidates) {
        const runtime = configToRuntime(cfg, model)
        if (runtime) return runtime
      }
    }
  }

  // Legacy fixed provider fallback
  const inferredProvider = model ? inferProviderFromModel(model) : null
  const preferred = (inferredProvider || user.preferredProvider || 'deepseek') as AIProvider

  const legacyResolvers: Record<string, () => ProviderRuntime | null> = {
    deepseek: () => {
      const key = process.env.DEEPSEEK_API_KEY || user.deepseekApiKey
      return key ? { apiKey: key, provider: 'deepseek', model, source: 'legacy' } : null
    },
    qwen: () => {
      const key = process.env.QWEN_API_KEY || user.qwenApiKey
      return key ? { apiKey: key, provider: 'qwen', model, source: 'legacy' } : null
    },
    gemini: () => {
      const key = process.env.GEMINI_API_KEY || user.geminiApiKey
      return key ? { apiKey: key, provider: 'gemini', model, source: 'legacy' } : null
    },
    ollama: () => ({
      apiKey: '',
      provider: 'ollama',
      ollamaBaseUrl: user.ollamaBaseUrl || 'http://localhost:11434',
      model,
      source: 'legacy',
    }),
  }

  const preferredResolved = legacyResolvers[preferred]?.()
  if (preferredResolved) return preferredResolved

  for (const key of ['deepseek', 'qwen', 'gemini', 'ollama'] as const) {
    const resolved = legacyResolvers[key]?.()
    if (resolved) return resolved
  }

  throw new Error('No AI provider configured. Please add an API key in Settings or install a model provider.')
}
