/**
 * Tests for RAG text chunking
 */
import { describe, it, expect } from 'vitest'
import { chunkText } from '@/lib/rag'

describe('chunkText', () => {
  it('returns empty array for empty input', () => {
    expect(chunkText('')).toEqual([])
    expect(chunkText('  ')).toEqual([])
  })

  it('returns single chunk for short text', () => {
    const text = 'This is a short text about friction.'
    const chunks = chunkText(text, { maxChunkSize: 100 })
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toBe(text)
  })

  it('splits long text into multiple chunks', () => {
    // Create text with ~600 words (should split into 2+ chunks at 400 words)
    const sentences = Array.from({ length: 60 }, (_, i) =>
      `This is sentence number ${i + 1} about physics and friction forces.`
    )
    const text = sentences.join(' ')
    const chunks = chunkText(text, { maxChunkSize: 400, overlap: 50 })

    expect(chunks.length).toBeGreaterThan(1)
    // Each chunk should be non-empty
    chunks.forEach(chunk => expect(chunk.length).toBeGreaterThan(0))
  })

  it('respects maxChunkSize approximately', () => {
    const sentences = Array.from({ length: 100 }, (_, i) =>
      `Sentence ${i + 1} discusses an important concept.`
    )
    const text = sentences.join(' ')
    const chunks = chunkText(text, { maxChunkSize: 50, overlap: 10 })

    // Each chunk should be roughly within the limit (sentences may push it slightly over)
    chunks.forEach(chunk => {
      const wordCount = chunk.split(/\s+/).length
      // Allow some tolerance since we don't split mid-sentence
      expect(wordCount).toBeLessThan(100)
    })
  })

  it('handles text with no sentence boundaries', () => {
    const text = Array.from({ length: 500 }, () => 'word').join(' ')
    const chunks = chunkText(text, { maxChunkSize: 100 })
    // Should produce at least one chunk
    expect(chunks.length).toBeGreaterThanOrEqual(1)
  })

  it('provides overlap between chunks', () => {
    const sentences = Array.from({ length: 40 }, (_, i) =>
      `Unique sentence ${i + 1} about topic.`
    )
    const text = sentences.join(' ')
    const chunks = chunkText(text, { maxChunkSize: 100, overlap: 20 })

    if (chunks.length >= 2) {
      // The end of chunk 1 and start of chunk 2 should overlap
      const words1 = chunks[0].split(/\s+/)
      const words2 = chunks[1].split(/\s+/)
      const lastWordsOfChunk1 = words1.slice(-5).join(' ')
      // Chunk 2 should contain some overlap from chunk 1
      expect(chunks[1]).toContain(lastWordsOfChunk1.split(' ')[0])
    }
  })
})
