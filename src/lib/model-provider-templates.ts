export type ProviderCategory =
  | 'global'
  | 'china'
  | 'aggregator'
  | 'local'
  | 'special'

export type ProviderTemplate = {
  id: string
  name: string
  category: ProviderCategory
  defaultModel?: string
  defaultBaseUrl?: string
  apiKeyPlaceholder?: string
  notes?: string
}

export type ProviderConfig = {
  id: string
  name: string
  category: ProviderCategory
  apiKey?: string
  baseUrl?: string
  model?: string
  models?: string[]
  enabled: boolean
  credits?: number
}

export const PROVIDER_TEMPLATES: ProviderTemplate[] = [
  // Global
  { id: 'openai', name: 'OpenAI', category: 'global', defaultModel: 'gpt-4o', defaultBaseUrl: 'https://api.openai.com/v1', apiKeyPlaceholder: 'sk-...' },
  { id: 'anthropic', name: 'Anthropic', category: 'global', defaultModel: 'claude-3-5-sonnet-latest', defaultBaseUrl: 'https://api.anthropic.com', apiKeyPlaceholder: 'sk-ant-...' },
  { id: 'google', name: 'Google Gemini', category: 'global', defaultModel: 'gemini-1.5-flash', defaultBaseUrl: 'https://generativelanguage.googleapis.com', apiKeyPlaceholder: 'AIza...' },
  { id: 'azure-openai', name: 'Azure OpenAI', category: 'global', defaultModel: 'gpt-4o', apiKeyPlaceholder: 'azure-key...' },
  { id: 'mistral', name: 'Mistral AI', category: 'global', defaultModel: 'mistral-large-latest', defaultBaseUrl: 'https://api.mistral.ai/v1', apiKeyPlaceholder: 'mistral-...' },
  { id: 'cohere', name: 'Cohere', category: 'global', defaultModel: 'command-r-plus', defaultBaseUrl: 'https://api.cohere.com/v1', apiKeyPlaceholder: 'co-...' },

  // China local vendors
  { id: 'deepseek', name: 'DeepSeek', category: 'china', defaultModel: 'deepseek-chat', defaultBaseUrl: 'https://api.deepseek.com/v1', apiKeyPlaceholder: 'sk-...' },
  { id: 'zhipu', name: 'ZhipuAI (GLM)', category: 'china', defaultModel: 'glm-4', defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4', apiKeyPlaceholder: 'zhipu-...' },
  { id: 'moonshot', name: 'Moonshot AI (Kimi)', category: 'china', defaultModel: 'moonshot-v1-8k', defaultBaseUrl: 'https://api.moonshot.cn/v1', apiKeyPlaceholder: 'sk-...' },
  { id: 'tongyi', name: 'Alibaba Tongyi (Qwen)', category: 'china', defaultModel: 'qwen-plus', defaultBaseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', apiKeyPlaceholder: 'sk-...' },
  { id: 'wenxin', name: 'Baidu Wenxin', category: 'china', defaultModel: 'ernie-4.0', apiKeyPlaceholder: 'ak/sk...' },
  { id: 'hunyuan', name: 'Tencent Hunyuan', category: 'china', defaultModel: 'hunyuan-pro', apiKeyPlaceholder: 'tencent-...' },
  { id: '01ai', name: '01.AI', category: 'china', defaultModel: 'yi-large', apiKeyPlaceholder: 'yi-...' },
  { id: 'baichuan', name: 'Baichuan AI', category: 'china', defaultModel: 'baichuan4', apiKeyPlaceholder: 'bc-...' },
  { id: 'doubao', name: 'ByteDance Doubao', category: 'china', defaultModel: 'doubao-pro', apiKeyPlaceholder: 'ark-...' },

  // API aggregators
  { id: 'openrouter', name: 'OpenRouter', category: 'aggregator', defaultModel: 'openai/gpt-4o-mini', defaultBaseUrl: 'https://openrouter.ai/api/v1', apiKeyPlaceholder: 'sk-or-...' },
  { id: 'together', name: 'Together.ai', category: 'aggregator', defaultModel: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', defaultBaseUrl: 'https://api.together.xyz/v1', apiKeyPlaceholder: 'together-...' },
  { id: 'groq', name: 'Groq', category: 'aggregator', defaultModel: 'llama-3.1-70b-versatile', defaultBaseUrl: 'https://api.groq.com/openai/v1', apiKeyPlaceholder: 'gsk_...' },
  { id: 'siliconflow', name: 'SiliconFlow', category: 'aggregator', defaultModel: 'Qwen/Qwen2.5-72B-Instruct', defaultBaseUrl: 'https://api.siliconflow.cn/v1', apiKeyPlaceholder: 'sk-...' },

  // Local/custom
  { id: 'ollama', name: 'Ollama', category: 'local', defaultModel: 'llama3', defaultBaseUrl: 'http://localhost:11434/v1', notes: 'No API key required for local deployment.' },
  { id: 'xinference', name: 'Xinference', category: 'local', defaultBaseUrl: 'http://localhost:9997/v1' },
  { id: 'localai', name: 'LocalAI', category: 'local', defaultBaseUrl: 'http://localhost:8080/v1' },
  { id: 'openai-compatible', name: 'OpenAI-Compatible', category: 'local', defaultBaseUrl: 'https://your-endpoint.example.com/v1', notes: 'Any OpenAI-compatible third-party endpoint.' },

  // Special
  { id: 'huggingface', name: 'Hugging Face Inference', category: 'special', defaultModel: 'meta-llama/Llama-3.1-8B-Instruct', defaultBaseUrl: 'https://api-inference.huggingface.co/models' },
  { id: 'jina-ai', name: 'Jina AI', category: 'special', defaultModel: 'jina-embeddings-v3', defaultBaseUrl: 'https://api.jina.ai/v1' },
]

export function getTemplateById(id: string): ProviderTemplate | undefined {
  return PROVIDER_TEMPLATES.find((t) => t.id === id)
}

export function toProviderConfig(template: ProviderTemplate): ProviderConfig {
  const initialModels = template.defaultModel ? [template.defaultModel] : []
  return {
    id: template.id,
    name: template.name,
    category: template.category,
    model: template.defaultModel,
    models: initialModels,
    baseUrl: template.defaultBaseUrl,
    apiKey: '',
    enabled: true,
  }
}
