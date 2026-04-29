"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { generateContent, AIProvider } from "@/lib/ai"
import bcrypt from "bcryptjs"
import { Prisma } from "@prisma/client"
import type { ProviderConfig } from "@/lib/model-provider-templates"
import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

function toJsonValue(value: unknown): Prisma.InputJsonValue | Prisma.NullTypes.JsonNull | undefined {
  if (value === undefined) return undefined
  if (value === null) return Prisma.JsonNull
  return value as Prisma.InputJsonValue
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

type ProviderTestInput = {
  id: string
  category?: string
  apiKey?: string
  baseUrl?: string
  model?: string
}

type ProviderModelDiscoveryInput = {
  id: string
  category?: string
  apiKey?: string
  baseUrl?: string
}

type ProviderConfigWithMeta = ProviderConfig & {
  hasStoredApiKey?: boolean
}

function toOllamaBaseUrl(url?: string): string {
  if (!url) return "http://localhost:11434"
  return url.replace(/\/+$/, "").replace(/\/v1$/, "")
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

function parseOpenAICompatibleModels(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return []
  const rec = payload as Record<string, unknown>

  if (Array.isArray(rec.data)) {
    return uniqueNonEmpty(rec.data
      .map((item) => {
        if (!item || typeof item !== "object") return ""
        const row = item as Record<string, unknown>
        return typeof row.id === "string" ? row.id : ""
      }))
  }

  if (Array.isArray(rec.models)) {
    return uniqueNonEmpty(rec.models
      .map((item) => {
        if (typeof item === "string") return item
        if (!item || typeof item !== "object") return ""
        const row = item as Record<string, unknown>
        if (typeof row.id === "string") return row.id
        if (typeof row.name === "string") return row.name
        return ""
      }))
  }

  return []
}

function isPrivateOrLocalIp(address: string): boolean {
  const normalized = address.trim().toLowerCase()
  const version = isIP(normalized)
  if (version === 4) {
    const parts = normalized.split(".").map((p) => Number.parseInt(p, 10))
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true
    const [a, b] = parts
    if (a === 10 || a === 127 || a === 0) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 100 && b >= 64 && b <= 127) return true
    if (a === 198 && (b === 18 || b === 19)) return true
    return false
  }

  if (version === 6) {
    if (normalized === "::" || normalized === "::1") return true
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true
    if (/^fe[89ab]/.test(normalized)) return true
    if (normalized.startsWith("::ffff:")) {
      const mapped = normalized.substring("::ffff:".length)
      return isPrivateOrLocalIp(mapped)
    }
    return false
  }

  return true
}

function isLoopbackIp(address: string): boolean {
  const normalized = address.trim().toLowerCase()
  if (normalized === "::1") return true
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.substring("::ffff:".length)
    return isLoopbackIp(mapped)
  }
  if (isIP(normalized) === 4) {
    return normalized.startsWith("127.")
  }
  return false
}

async function assertSafeBaseUrl(rawUrl: string, options?: { allowLoopback?: boolean }): Promise<string> {
  const value = rawUrl.trim()
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error("Invalid Base URL")
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Base URL must use http or https")
  }

  const host = parsed.hostname.toLowerCase()
  const allowLoopback = options?.allowLoopback === true
  const isLocalHostName = host === "localhost" || host.endsWith(".localhost")
  if (isLocalHostName) {
    if (!allowLoopback) throw new Error("Localhost Base URL is not allowed for this provider")
    return value.replace(/\/+$/, "")
  }

  if (isIP(host)) {
    if (allowLoopback && isLoopbackIp(host)) {
      return value.replace(/\/+$/, "")
    }
    if (isPrivateOrLocalIp(host)) {
      throw new Error("Private or local network addresses are not allowed")
    }
    return value.replace(/\/+$/, "")
  }

  const resolved = await lookup(host, { all: true, verbatim: true })
  if (!resolved.length) throw new Error("Base URL host did not resolve")

  for (const row of resolved) {
    if (allowLoopback && isLoopbackIp(row.address)) {
      continue
    }
    if (isPrivateOrLocalIp(row.address)) {
      throw new Error("Base URL resolves to private or local network addresses")
    }
  }

  return value.replace(/\/+$/, "")
}

export async function updateApiKeysAction(data: {
  geminiKey?: string
  deepseekKey?: string
  qwenKey?: string
  ollamaUrl?: string
  preferredProvider?: string
  defaultModel?: string
  simulationModel?: string
  chatbotModel?: string
  analysisModel?: string
  modelProviders?: ProviderConfigWithMeta[]
  clearApiKeyProviderIds?: string[]
  deepseekCredits?: number
}) {
  const session = await auth()
  if (!session?.user?.email) throw new Error("Unauthorized")

  const update: Prisma.UserUpdateInput = {}
  if (data.geminiKey !== undefined) update.geminiApiKey = data.geminiKey || null
  if (data.deepseekKey !== undefined) update.deepseekApiKey = data.deepseekKey || null
  if (data.qwenKey !== undefined) update.qwenApiKey = data.qwenKey || null
  if (data.ollamaUrl !== undefined) update.ollamaBaseUrl = data.ollamaUrl || null
  if (data.preferredProvider) update.preferredProvider = data.preferredProvider
  if (data.defaultModel !== undefined) update.defaultModel = data.defaultModel
  if (data.simulationModel !== undefined) update.simulationModel = data.simulationModel || null
  if (data.chatbotModel !== undefined) update.chatbotModel = data.chatbotModel || null
  if (data.analysisModel !== undefined) update.analysisModel = data.analysisModel || null
  if (data.modelProviders !== undefined) {
    const existingUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { modelProviders: true },
    })
    const existingProviders = Array.isArray(existingUser?.modelProviders)
      ? (existingUser?.modelProviders as Array<Record<string, unknown>>)
      : []
    const existingById = new Map<string, Record<string, unknown>>()
    for (const row of existingProviders) {
      if (row && typeof row.id === "string") existingById.set(row.id, row)
    }

    const clearSet = new Set((data.clearApiKeyProviderIds || []).map((id) => id.toLowerCase()))
    const mergedProviders: ProviderConfig[] = data.modelProviders.map((incoming) => {
      const existing = existingById.get(incoming.id)
      const trimmedIncomingKey = incoming.apiKey?.trim() || ""
      const next: ProviderConfig = {
        id: incoming.id,
        name: incoming.name,
        category: incoming.category,
        enabled: incoming.enabled !== false,
        model: incoming.model,
        models: incoming.models,
        baseUrl: incoming.baseUrl,
      }

      if (trimmedIncomingKey) {
        next.apiKey = trimmedIncomingKey
      } else if (!clearSet.has(incoming.id.toLowerCase()) && existing && typeof existing.apiKey === "string" && existing.apiKey.trim()) {
        next.apiKey = existing.apiKey
      } else {
        next.apiKey = ""
      }

      if (typeof incoming.credits === "number") next.credits = incoming.credits
      return next
    })

    update.modelProviders = toJsonValue(mergedProviders)
  }
  if (typeof data.deepseekCredits === "number" && Number.isFinite(data.deepseekCredits)) {
    update.deepseekCredits = Math.max(0, Math.floor(data.deepseekCredits))
  }

  if (Object.keys(update).length === 0) return

  await prisma.user.update({
    where: { email: session.user.email },
    data: update,
  })

  revalidatePath("/dashboard/settings")
}

export async function testProviderAction(input: string | ProviderTestInput): Promise<{ success: boolean; message: string }> {
  const session = await auth()
  if (!session?.user?.email) throw new Error("Unauthorized")

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      geminiApiKey: true,
      deepseekApiKey: true,
      qwenApiKey: true,
      ollamaBaseUrl: true,
      modelProviders: true,
    },
  })
  if (!user) throw new Error("User not found")

  const payload: ProviderTestInput = typeof input === "string" ? { id: input } : input
  const providerId = payload.id.toLowerCase()

  let provider: AIProvider = "deepseek"
  let apiKey = payload.apiKey?.trim() || ""
  let ollamaBaseUrl: string | undefined
  let baseUrl = payload.baseUrl?.trim() || undefined
  let model = payload.model?.trim() || undefined

  if (providerId === "deepseek") {
    provider = "deepseek"
    apiKey = apiKey || process.env.DEEPSEEK_API_KEY || user.deepseekApiKey || ""
    model = model || "deepseek-v4-flash"
  } else if (providerId === "qwen" || providerId === "tongyi") {
    provider = "qwen"
    apiKey = apiKey || process.env.QWEN_API_KEY || user.qwenApiKey || ""
    model = model || "qwen-plus"
  } else if (providerId === "google" || providerId === "gemini") {
    provider = "gemini"
    apiKey = apiKey || process.env.GEMINI_API_KEY || user.geminiApiKey || ""
    model = model || "gemini-1.5-flash"
  } else if (providerId === "ollama") {
    provider = "ollama"
    ollamaBaseUrl = await assertSafeBaseUrl(
      toOllamaBaseUrl(payload.baseUrl || user.ollamaBaseUrl || undefined),
      { allowLoopback: true }
    )
    apiKey = ""
    model = model || "llama3"
  } else {
    // Route dynamic providers through OpenAI-compatible path with custom base URL.
    if (!baseUrl) {
      const existing = Array.isArray(user.modelProviders)
        ? (user.modelProviders as Array<Record<string, unknown>>).find((p) => p?.id === providerId)
        : undefined
      if (existing && typeof existing.baseUrl === "string") baseUrl = existing.baseUrl
      if (!apiKey && existing && typeof existing.apiKey === "string") apiKey = existing.apiKey
      if (!model && existing && typeof existing.model === "string") model = existing.model
    }
    if (!baseUrl) {
      return { success: false, message: "This provider needs a Base URL to test." }
    }
    baseUrl = await assertSafeBaseUrl(baseUrl, { allowLoopback: payload.category === "local" })
    provider = "deepseek"
    model = model || "gpt-4o-mini"
  }

  const needsKey = provider !== "ollama" && payload.category !== "local"
  if (needsKey && !apiKey) {
    return { success: false, message: "No API key configured for this provider." }
  }

  try {
    const response = await generateContent(
      "Reply with exactly: Connection successful!",
      apiKey,
      provider,
      { ollamaBaseUrl, baseUrl, model }
    )
    return { success: true, message: response.substring(0, 100) }
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Connection failed").substring(0, 200) }
  }
}

export async function fetchOllamaModelsAction(baseUrl: string): Promise<{ success: boolean; models?: string[] }> {
  try {
    const safeUrl = await assertSafeBaseUrl(baseUrl, { allowLoopback: true })
    const res = await fetch(`${safeUrl.replace(/\/+$/, "")}/api/tags`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return { success: false }
    const data = await res.json() as { models?: Array<{ name?: string }> }
    const models = (data.models || []).map((m) => m.name || "").filter(Boolean)
    return { success: true, models }
  } catch {
    return { success: false }
  }
}

export async function discoverProviderModelsAction(input: ProviderModelDiscoveryInput): Promise<{ success: boolean; models?: string[]; message?: string }> {
  const session = await auth()
  if (!session?.user?.email) throw new Error("Unauthorized")

  const payload = {
    id: input.id.toLowerCase(),
    category: input.category,
    apiKey: input.apiKey?.trim() || "",
    baseUrl: input.baseUrl?.trim() || "",
  }

  if (payload.id === "ollama") {
    const result = await fetchOllamaModelsAction(payload.baseUrl || "http://localhost:11434")
    if (!result.success) return { success: false, message: "Failed to fetch local models." }
    return { success: true, models: result.models || [] }
  }

  if (payload.id === "google" || payload.id === "gemini") {
    const apiKey = payload.apiKey
    if (!apiKey) {
      return { success: false, message: "Gemini requires API key to discover models." }
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
      if (!res.ok) {
        return { success: false, message: `Discovery failed (${res.status}).` }
      }
      const json = await res.json() as { models?: Array<{ name?: string }> }
      const models = uniqueNonEmpty((json.models || []).map((m) => (m.name || "").replace(/^models\//, "")))
      if (models.length === 0) {
        return { success: false, message: "No models returned by provider." }
      }
      return { success: true, models }
    } catch (error: unknown) {
      return { success: false, message: getErrorMessage(error, "Discovery failed") }
    }
  }

  const baseUrl = payload.baseUrl.replace(/\/+$/, "")
  if (!baseUrl) {
    return { success: false, message: "Base URL is required to discover models." }
  }
  let safeBaseUrl: string
  try {
    safeBaseUrl = await assertSafeBaseUrl(baseUrl, { allowLoopback: payload.category === "local" })
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Unsafe Base URL") }
  }

  const headers: HeadersInit = { "Content-Type": "application/json" }
  if (payload.apiKey) headers.Authorization = `Bearer ${payload.apiKey}`

  try {
    const res = await fetch(`${safeBaseUrl}/models`, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      return { success: false, message: `Discovery failed (${res.status}).` }
    }

    const json = await res.json()
    const models = parseOpenAICompatibleModels(json)

    if (models.length === 0) {
      return { success: false, message: "No models returned by provider." }
    }

    return { success: true, models }
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error, "Discovery failed") }
  }
}

export async function changePasswordAction(data: {
  currentPassword: string
  newPassword: string
}): Promise<{ success: boolean; message: string }> {
  const session = await auth()
  if (!session?.user?.email) throw new Error("Unauthorized")

  if (!data.currentPassword || !data.newPassword) {
    return { success: false, message: "Please fill in all fields." }
  }

  if (data.newPassword.length < 6) {
    return { success: false, message: "New password must be at least 6 characters." }
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { password: true },
  })
  if (!user) return { success: false, message: "User not found." }

  const isValid = await bcrypt.compare(data.currentPassword, user.password)
  if (!isValid) {
    return { success: false, message: "Current password is incorrect." }
  }

  const hashedPassword = await bcrypt.hash(data.newPassword, 10)
  await prisma.user.update({
    where: { email: session.user.email },
    data: { password: hashedPassword },
  })

  return { success: true, message: "Password changed successfully!" }
}

