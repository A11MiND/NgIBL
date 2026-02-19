"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Brain, X } from "lucide-react"
import { analyzeAnswersAction } from "./actions"

export function AnalysisPanel({ experimentId, dict }: { experimentId: string; dict: any }) {
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAnalyze() {
    setLoading(true)
    setError(null)
    try {
      const result = await analyzeAnswersAction(experimentId)
      if (result.success && result.analysis) {
        setAnalysis(result.analysis)
      } else {
        setError(result.error || 'Analysis failed')
      }
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      {!analysis && (
        <Button onClick={handleAnalyze} disabled={loading} variant="outline">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {dict.results?.analyzing || 'Analyzing with AI...'}
            </>
          ) : (
            <>
              <Brain className="mr-2 h-4 w-4" />
              {dict.results?.aiAnalysis || 'AI Analysis'}
            </>
          )}
        </Button>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {analysis && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500" />
              {dict.results?.aiAnalysis || 'AI Analysis'}
            </CardTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAnalysis(null)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: formatMarkdown(analysis) }}
            />
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="outline" onClick={handleAnalyze} disabled={loading}>
                {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                Re-analyze
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Simple markdown to HTML converter for the analysis output
function formatMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3 class="font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="font-bold mt-4 mb-2 text-base">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="font-bold mt-4 mb-2 text-lg">$1</h1>')
    .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4">$1. $2</li>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>')
}
