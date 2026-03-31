"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Users, AlertTriangle } from "lucide-react"
import { compareTwoClassesAction } from "./actions"

export function ClassComparisonPanel({
  experimentId,
  classes,
}: {
  experimentId: string
  classes: string[]
}) {
  const [classA, setClassA] = useState(classes[0] || "")
  const [classB, setClassB] = useState(classes[1] || "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<null | {
    classA: string
    classB: string
    classAStats: { avgCorrect: number; avgPartial: number; avgIncorrect: number }
    classBStats: { avgCorrect: number; avgPartial: number; avgIncorrect: number }
    perQuestion: Array<{
      question: string
      classACorrect: number
      classBCorrect: number
      classAIncorrect: number
      classBIncorrect: number
      correctDelta: number
      incorrectDelta: number
    }>
    hotspots: Array<{ question: string; incorrectPct: number; weakerClass: string }>
  }>(null)

  const canCompare = classA && classB && classA !== classB

  const strongerClass = useMemo(() => {
    if (!result) return null
    return result.classAStats.avgCorrect >= result.classBStats.avgCorrect ? result.classA : result.classB
  }, [result])

  async function handleCompare() {
    if (!canCompare) return
    setLoading(true)
    setError(null)
    try {
      const data = await compareTwoClassesAction(experimentId, classA, classB)
      if (!data.success || !data.classAStats || !data.classBStats || !data.perQuestion || !data.hotspots || !data.classA || !data.classB) {
        setError(data.error || "Class comparison failed")
      } else {
        setResult({
          classA: data.classA,
          classB: data.classB,
          classAStats: data.classAStats,
          classBStats: data.classBStats,
          perQuestion: data.perQuestion,
          hotspots: data.hotspots,
        })
      }
    } catch (e: any) {
      setError(e.message || "Class comparison failed")
    }
    setLoading(false)
  }

  if (classes.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Two-Class Comparison
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Need at least two distinct classes with submissions to run class-vs-class comparison.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          Two-Class Comparison
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto] gap-2 items-end">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Class A</p>
            <Select value={classA} onValueChange={setClassA}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-center text-muted-foreground text-sm">vs</div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Class B</p>
            <Select value={classB} onValueChange={setClassB}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleCompare} disabled={!canCompare || loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Compare"}
          </Button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <p className="font-medium">{result.classA}</p>
                <p className="text-sm text-muted-foreground">Avg Correct: <span className="text-green-600 font-semibold">{result.classAStats.avgCorrect}%</span></p>
                <p className="text-sm text-muted-foreground">Avg Incorrect: <span className="text-red-600 font-semibold">{result.classAStats.avgIncorrect}%</span></p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="font-medium">{result.classB}</p>
                <p className="text-sm text-muted-foreground">Avg Correct: <span className="text-green-600 font-semibold">{result.classBStats.avgCorrect}%</span></p>
                <p className="text-sm text-muted-foreground">Avg Incorrect: <span className="text-red-600 font-semibold">{result.classBStats.avgIncorrect}%</span></p>
              </div>
            </div>

            {strongerClass && (
              <p className="text-sm text-muted-foreground">
                Current stronger class by average correctness: <span className="font-semibold text-foreground">{strongerClass}</span>
              </p>
            )}

            <div className="rounded-lg border p-3">
              <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Mistake Hotspots
              </p>
              <div className="space-y-2">
                {result.hotspots.map((h) => (
                  <div key={h.question} className="text-sm flex items-center justify-between gap-2">
                    <span className="truncate">{h.question}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {h.weakerClass} · {h.incorrectPct}% incorrect
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border p-3 overflow-x-auto">
              <p className="text-sm font-semibold mb-2">Per-Question Delta (A - B)</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-1 pr-2">Question</th>
                    <th className="py-1 pr-2">{result.classA} Correct</th>
                    <th className="py-1 pr-2">{result.classB} Correct</th>
                    <th className="py-1 pr-2">Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {result.perQuestion.map((row) => (
                    <tr key={row.question} className="border-b last:border-0">
                      <td className="py-1 pr-2 max-w-[280px] truncate">{row.question}</td>
                      <td className="py-1 pr-2">{row.classACorrect}%</td>
                      <td className="py-1 pr-2">{row.classBCorrect}%</td>
                      <td className={`py-1 pr-2 ${row.correctDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {row.correctDelta >= 0 ? '+' : ''}{row.correctDelta}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}