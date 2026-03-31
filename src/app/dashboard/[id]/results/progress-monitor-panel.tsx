"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, TrendingUp } from "lucide-react"
import { getProgressOverviewAction } from "./actions"

export function ProgressMonitorPanel({ experimentId, classes }: { experimentId: string; classes: string[] }) {
  const [selectedClass, setSelectedClass] = useState("all")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<null | {
    classAverages: Array<{ className: string; avgProgress: number; students: number }>
    studentRows: Array<{ studentId: string; studentName: string; className: string; progress: number; submittedAt: string }>
  }>(null)

  const topClass = useMemo(() => (data?.classAverages?.[0] ? data.classAverages[0] : null), [data])

  async function handleLoad() {
    setLoading(true)
    setError(null)
    try {
      const result = await getProgressOverviewAction(experimentId, selectedClass === "all" ? undefined : selectedClass)
      if (!result.success || !result.classAverages || !result.studentRows) {
        setError(result.error || "Failed to load progress overview")
      } else {
        setData({ classAverages: result.classAverages, studentRows: result.studentRows })
      }
    } catch (e: any) {
      setError(e.message || "Failed to load progress overview")
    }
    setLoading(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-emerald-500" />
          Progress Monitor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-full sm:w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleLoad} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load Progress"}
          </Button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {data && (
          <div className="space-y-4">
            {topClass && (
              <p className="text-sm text-muted-foreground">
                Leading class by completion: <span className="font-semibold text-foreground">{topClass.className}</span> ({topClass.avgProgress}%)
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <p className="font-medium mb-2">Class Averages</p>
                <div className="space-y-1.5 text-sm">
                  {data.classAverages.map((c) => (
                    <div key={c.className} className="flex justify-between gap-2">
                      <span>{c.className}</span>
                      <span className="font-medium">{c.avgProgress}% ({c.students} students)</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <p className="font-medium mb-2">Student Progress (Latest)</p>
                <div className="space-y-1.5 text-sm max-h-48 overflow-y-auto pr-1">
                  {data.studentRows.slice(0, 12).map((s) => (
                    <div key={`${s.studentId}-${s.submittedAt}`} className="flex justify-between gap-2">
                      <span className="truncate">{s.studentName} · {s.className}</span>
                      <span className="font-medium">{s.progress}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}