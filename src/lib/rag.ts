/**
 * RAG (Retrieval-Augmented Generation) System
 * 
 * Proper RAG implementation using pgvector for semantic search.
 * Replaces naive string concatenation with:
 * 1. Text chunking — splits large documents into manageable pieces
 * 2. Embedding generation — converts text to vectors via AI providers
 * 3. Vector storage — stores in PostgreSQL with pgvector extension
 * 4. Semantic search — finds the most relevant chunks for a query
 * 
 * Supports multiple embedding providers:
 * - Gemini (text-embedding-004, 768 dimensions) — FREE
 * - DeepSeek (via OpenAI-compatible API)
 * - Ollama (local, nomic-embed-text)
 */

import { prisma } from './prisma'
import { logger } from './logger'

// ─── Text Chunking ──────────────────────────────────────────────────

/**
 * Split text into overlapping chunks for embedding.
 * Uses sentence-aware splitting to avoid cutting mid-sentence.
 */
export function chunkText(
  text: string,
  options: {
    maxChunkSize?: number  // Max words per chunk
    overlap?: number       // Overlap words between chunks
  } = {}
): string[] {
  const { maxChunkSize = 400, overlap = 50 } = options

  if (!text || text.trim().length === 0) return []

  // Split by sentences first
  const sentences = text.split(/(?<=[.!?。！？])\s+/).filter(s => s.trim())
  const chunks: string[] = []
  let currentChunk: string[] = []
  let currentWordCount = 0

  for (const sentence of sentences) {
    const sentenceWords = sentence.split(/\s+/).length

    if (currentWordCount + sentenceWords > maxChunkSize && currentChunk.length > 0) {
      // Save current chunk
      chunks.push(currentChunk.join(' ').trim())

      // Keep overlap
      const overlapText = currentChunk.join(' ').split(/\s+/)
      const overlapWords = overlapText.slice(-overlap)
      currentChunk = [overlapWords.join(' ')]
      currentWordCount = overlap
    }

    currentChunk.push(sentence)
    currentWordCount += sentenceWords
  }

  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' ').trim())
  }

  return chunks.filter(c => c.length > 0)
}

// ─── Embedding Generation ───────────────────────────────────────────

/**
 * Generate embedding vector for a text using the configured provider.
 * Returns a 768-dimension vector (Gemini text-embedding-004).
 */
export async function generateEmbedding(
  text: string,
  options: {
    provider?: 'gemini' | 'deepseek' | 'ollama'
    apiKey?: string
    ollamaBaseUrl?: string
  } = {}
): Promise<number[]> {
  const provider = options.provider || 'gemini'

  switch (provider) {
    case 'gemini':
      return generateGeminiEmbedding(text, options.apiKey || '')
    case 'deepseek':
      return generateOpenAICompatibleEmbedding(
        text,
        'https://api.deepseek.com',
        options.apiKey || '',
        'deepseek-chat'
      )
    case 'ollama':
      return generateOllamaEmbedding(
        text,
        options.ollamaBaseUrl || 'http://localhost:11434'
      )
    default:
      throw new Error(`Unsupported embedding provider: ${provider}`)
  }
}

/**
 * Gemini text-embedding-004 (768 dimensions, FREE tier)
 */
async function generateGeminiEmbedding(text: string, apiKey: string): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      content: { parts: [{ text }] },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Gemini Embedding API Error: ${error}`)
  }

  const data = await response.json()
  return data.embedding.values
}

/**
 * OpenAI-compatible embedding endpoint (DeepSeek, etc.)
 */
async function generateOpenAICompatibleEmbedding(
  text: string,
  baseUrl: string,
  apiKey: string,
  model: string
): Promise<number[]> {
  const url = `${baseUrl.replace(/\/+$/, '')}/embeddings`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: text }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Embedding API Error: ${error}`)
  }

  const data = await response.json()
  return data.data[0].embedding
}

/**
 * Ollama local embedding (nomic-embed-text, 768 dimensions)
 */
async function generateOllamaEmbedding(text: string, baseUrl: string): Promise<number[]> {
  const url = `${baseUrl.replace(/\/+$/, '')}/api/embed`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'nomic-embed-text', input: text }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Ollama Embedding Error: ${error}`)
  }

  const data = await response.json()
  return data.embeddings[0]
}

// ─── Index Experiment Context ───────────────────────────────────────

/**
 * Process experiment's aiContext into vector embeddings.
 * Call this when aiContext is created or updated.
 */
export async function indexExperimentContext(
  experimentId: string,
  aiContext: string,
  options: {
    provider?: 'gemini' | 'deepseek' | 'ollama'
    apiKey?: string
    ollamaBaseUrl?: string
  } = {}
): Promise<{ chunksIndexed: number }> {
  const startTime = Date.now()

  // Delete existing embeddings for this experiment
  await prisma.embedding.deleteMany({
    where: { experimentId },
  })

  if (!aiContext || aiContext.trim().length === 0) {
    return { chunksIndexed: 0 }
  }

  const chunks = chunkText(aiContext)
  let indexed = 0

  for (const [index, chunk] of chunks.entries()) {
    try {
      const embedding = await generateEmbedding(chunk, options)

      // Store using raw SQL for vector type
      await prisma.$executeRaw`
        INSERT INTO "Embedding" (id, "experimentId", "chunkText", "chunkIndex", embedding, "createdAt")
        VALUES (
          ${crypto.randomUUID()},
          ${experimentId},
          ${chunk},
          ${index},
          ${JSON.stringify(embedding)}::vector,
          NOW()
        )
      `
      indexed++
    } catch (error) {
      logger.warn({
        experimentId,
        chunkIndex: index,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to embed chunk')
    }
  }

  logger.info({
    experimentId,
    totalChunks: chunks.length,
    indexed,
    duration: Date.now() - startTime,
  }, 'Experiment context indexed')

  return { chunksIndexed: indexed }
}

// ─── Semantic Search ────────────────────────────────────────────────

/**
 * Find the most relevant chunks from an experiment's context
 * for a given query using vector similarity search.
 */
export async function semanticSearch(
  experimentId: string,
  query: string,
  options: {
    limit?: number
    minSimilarity?: number
    provider?: 'gemini' | 'deepseek' | 'ollama'
    apiKey?: string
    ollamaBaseUrl?: string
  } = {}
): Promise<Array<{ chunk: string; similarity: number; chunkIndex: number }>> {
  const { limit = 3, minSimilarity = 0.5 } = options

  try {
    // Check if any embeddings exist
    const embeddingCount = await prisma.embedding.count({
      where: { experimentId },
    })

    if (embeddingCount === 0) {
      // No embeddings — fall back to returning full aiContext (legacy behavior)
      return []
    }

    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query, options)

    // Perform vector similarity search using pgvector
    const results = await prisma.$queryRaw<
      Array<{ chunk_text: string; similarity: number; chunk_index: number }>
    >`
      SELECT 
        "chunkText" as chunk_text,
        "chunkIndex" as chunk_index,
        1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
      FROM "Embedding"
      WHERE "experimentId" = ${experimentId}
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
      LIMIT ${limit}
    `

    return results
      .filter(r => r.similarity >= minSimilarity)
      .map(r => ({
        chunk: r.chunk_text,
        similarity: r.similarity,
        chunkIndex: r.chunk_index,
      }))
  } catch (error) {
    logger.warn({
      experimentId,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Semantic search failed — falling back to legacy')
    return []
  }
}

/**
 * Get relevant context for the chatbot using RAG.
 * Falls back to full aiContext if embeddings are not available.
 */
export async function getRAGContext(
  experimentId: string,
  query: string,
  fullContext: string | null,
  options: {
    provider?: 'gemini' | 'deepseek' | 'ollama'
    apiKey?: string
    ollamaBaseUrl?: string
  } = {}
): Promise<string> {
  // Try semantic search first
  const results = await semanticSearch(experimentId, query, {
    ...options,
    limit: 3,
    minSimilarity: 0.4,
  })

  if (results.length > 0) {
    // Use semantically relevant chunks
    return results
      .map((r, i) => `[Reference ${i + 1} (relevance: ${(r.similarity * 100).toFixed(0)}%)]\n${r.chunk}`)
      .join('\n\n---\n\n')
  }

  // Fallback: use full context (legacy behavior for non-indexed experiments)
  return fullContext || ''
}
