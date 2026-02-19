"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Brain, X, User, GripHorizontal } from "lucide-react"
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
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [centered, setCentered] = useState(true)
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  // Reset position when opening
  useEffect(() => {
    if (open) {
      setPosition({ x: 0, y: 0 })
      setCentered(true)
    }
  }, [open])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    if (centered && cardRef.current) {
      // Switch from centered to absolute positioning
      const rect = cardRef.current.getBoundingClientRect()
      setPosition({ x: rect.left, y: rect.top })
      setCentered(false)
      dragRef.current = { startX: e.clientX, startY: e.clientY, origX: rect.left, origY: rect.top }
    } else {
      dragRef.current = { startX: e.clientX, startY: e.clientY, origX: position.x, origY: position.y }
    }

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const dx = ev.clientX - dragRef.current.startX
      const dy = ev.clientY - dragRef.current.startY
      setPosition({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy })
    }
    const handleMouseUp = () => {
      dragRef.current = null
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
  }, [centered, position])

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
        <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setOpen(false)}>
          <div
            className={centered ? "flex items-center justify-center h-full p-4" : ""}
            onClick={e => e.stopPropagation()}
          >
            <Card
              ref={cardRef}
              className="w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl"
              style={centered ? {} : { position: "fixed", left: position.x, top: position.y }}
              onClick={e => e.stopPropagation()}
            >
              <CardHeader
                className="pb-3 flex flex-row items-center justify-between shrink-0 border-b cursor-grab active:cursor-grabbing select-none"
                onMouseDown={handleMouseDown}
              >
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5 text-purple-500" />
                  {studentName} — {dict.results?.studentAnalysis || "Student Analysis"}
                  <GripHorizontal className="h-4 w-4 text-muted-foreground ml-1" />
                </CardTitle>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <div className="flex-1 overflow-y-auto">
                <CardContent className="pt-4">
                  {loading && (
                    <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>{dict.results?.analyzing || "Analyzing with AI..."}</span>
                    </div>
                  )}
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  {analysis && (
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none break-words"
                      dangerouslySetInnerHTML={{ __html: formatMarkdown(analysis) }}
                    />
                  )}
                </CardContent>
              </div>
            </Card>
          </div>
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
