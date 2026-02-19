"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Brain, X, BarChart3 } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts"
import { analyzeAnswersAction } from "./actions"

type ChartDataItem = { question: string; correctPct: number; partialPct: number; incorrectPct: number }

export function AnalysisPanel({ experimentId, dict }: { experimentId: string; dict: any }) {
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [chartData, setChartData] = useState<ChartDataItem[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAnalyze() {
    setLoading(true)
    setError(null)
    try {
      const result = await analyzeAnswersAction(experimentId)
      if (result.success && result.analysis) {
        setAnalysis(result.analysis)
        if (result.chartData) {
          setChartData(result.chartData)
        }
      } else {
        setError(result.error || 'Analysis failed')
      }
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  // Calculate overall summary for the donut-style display
  const overallStats = chartData ? {
    avgCorrect: Math.round(chartData.reduce((s, d) => s + d.correctPct, 0) / chartData.length),
    avgPartial: Math.round(chartData.reduce((s, d) => s + d.partialPct, 0) / chartData.length),
    avgIncorrect: Math.round(chartData.reduce((s, d) => s + d.incorrectPct, 0) / chartData.length),
  } : null

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
          <CardHeader className="pb-3 flex flex-row items-center justify-between border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500" />
              {dict.results?.aiAnalysis || 'AI Analysis'}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleAnalyze} disabled={loading}>
                {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                Re-analyze
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setAnalysis(null); setChartData(null) }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-6">
            {/* Charts Section */}
            {chartData && chartData.length > 0 && (
              <div className="space-y-4">
                {/* Overall Summary Cards */}
                {overallStats && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border bg-green-50 dark:bg-green-950/30 p-3 text-center">
                      <div className="text-2xl font-bold text-green-600">{overallStats.avgCorrect}%</div>
                      <div className="text-xs text-muted-foreground">Correct</div>
                    </div>
                    <div className="rounded-lg border bg-yellow-50 dark:bg-yellow-950/30 p-3 text-center">
                      <div className="text-2xl font-bold text-yellow-600">{overallStats.avgPartial}%</div>
                      <div className="text-xs text-muted-foreground">Partial</div>
                    </div>
                    <div className="rounded-lg border bg-red-50 dark:bg-red-950/30 p-3 text-center">
                      <div className="text-2xl font-bold text-red-600">{overallStats.avgIncorrect}%</div>
                      <div className="text-xs text-muted-foreground">Incorrect</div>
                    </div>
                  </div>
                )}

                {/* Stacked Bar Chart - Per Question Breakdown */}
                <div className="rounded-lg border p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Per-Question Correctness
                  </h3>
                  <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 50 + 40)}>
                    <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <YAxis type="category" dataKey="question" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value: any, name: any) => [`${value}%`, name]}
                        contentStyle={{ fontSize: 12 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="correctPct" name="Correct" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="partialPct" name="Partial" stackId="a" fill="#eab308" />
                      <Bar dataKey="incorrectPct" name="Incorrect" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Text Analysis Section */}
            <div className="rounded-lg border p-4">
              <h3 className="text-sm font-semibold mb-3">Detailed Analysis</h3>
              <div
                className="prose prose-sm dark:prose-invert max-w-none break-words"
                dangerouslySetInnerHTML={{ __html: formatMarkdown(analysis) }}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function formatMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3 class="font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="font-bold mt-4 mb-2 text-base">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="font-bold mt-4 mb-2 text-lg">$1</h1>')
    .replace(/^- (.+)$/gm, '<li class="ml-4">• $1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4">$1. $2</li>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>')
}
