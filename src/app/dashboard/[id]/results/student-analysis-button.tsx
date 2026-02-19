"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Brain, X, User } from "lucide-react"
import { analyzeStudentAction } from "./actions"

export function StudentAnalysisButton({
  experimentId,
  submissionId,
  studentName,
  dict,
}: {
  experimentId: string
  submissionId: string
  studentName: string
  dict: any
}) {
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  async function handleAnalyze() {
    setOpen(true)
    setLoading(true)
    setError(null)
    try {
      const result = await analyzeStudentAction(experimentId, submissionId)
      if (result.success && result.analysis) {
        setAnalysis(result.analysis)
      } else {
        setError(result.error || "Analysis failed")
      }
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleAnalyze} disabled={loading}>
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
        {dict.results?.analyzeStudent || "Analyze"}
      </Button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <CardHeader className="pb-3 flex flex-row items-center justify-between shrink-0">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5 text-purple-500" />
                {studentName} — {dict.results?.studentAnalysis || "Student Analysis"}
              </CardTitle>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="overflow-y-auto">
              {loading && (
                <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>{dict.results?.analyzing || "Analyzing with AI..."}</span>
                </div>
              )}
              {error && <p className="text-sm text-red-600">{error}</p>}
              {analysis && (
                <div
                  className="prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: formatMarkdown(analysis) }}
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}

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
