"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { 
  GitFork, Eye, Code, Atom, Dna, FlaskConical, BookOpen, 
  Search, TrendingUp, Clock, Loader2 
} from "lucide-react"
import SimulationRunner from "@/components/simulation-runner"
import { forkSimulation, incrementViews } from "./actions"
import { useRouter, useSearchParams } from "next/navigation"

interface Simulation {
  id: string
  title: string
  description: string | null
  subject: string
  type: string
  reactCode: string | null
  geogebraFile: string | null
  geogebraMaterialId: string | null
  geogebraCommands: any
  geogebraSettings: any
  views: number
  forks: number
  user: {
    name: string | null
    email: string
  }
  createdAt: Date
}

export default function CommunityGrid({ 
  simulations, 
  currentUserId 
}: { 
  simulations: Simulation[]
  currentUserId: string 
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [subject, setSubject] = useState(searchParams.get('subject') || 'all')
  const [sort, setSort] = useState(searchParams.get('sort') || 'recent')
  
  const [previewSim, setPreviewSim] = useState<Simulation | null>(null)
  const [forking, setForking] = useState<string | null>(null)

  const getIcon = (subject: string) => {
    switch (subject) {
      case "Physics": return <Atom className="h-5 w-5 text-blue-500" />
      case "Chemistry": return <FlaskConical className="h-5 w-5 text-purple-500" />
      case "Biology": return <Dna className="h-5 w-5 text-green-500" />
      case "Math": case "Maths": return <Code className="h-5 w-5 text-orange-500" />
      default: return <BookOpen className="h-5 w-5 text-gray-500" />
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "REACT": return "React"
      case "GEOGEBRA_FILE": return "GeoGebra File"
      case "GEOGEBRA_API": return "GeoGebra"
      default: return type
    }
  }

  function handleSearchChange(value: string) {
    setSearch(value)
    updateUrl({ search: value })
  }

  function handleSubjectChange(value: string) {
    setSubject(value)
    updateUrl({ subject: value === 'all' ? undefined : value })
  }

  function handleSortChange(value: string) {
    setSort(value)
    updateUrl({ sort: value })
  }

  function updateUrl(params: Record<string, string | undefined>) {
    const current = new URLSearchParams(searchParams.toString())
    
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        current.set(key, value)
      } else {
        current.delete(key)
      }
    })
    
    router.push(`/community?${current.toString()}`)
  }

  async function handleFork(id: string) {
    setForking(id)
    const result = await forkSimulation(id)
    
    if (result.success) {
      router.push(`/library`)
    } else {
      alert('Failed to fork: ' + result.error)
    }
    
    setForking(null)
  }

  function handlePreview(sim: Simulation) {
    setPreviewSim(sim)
    incrementViews(sim.id) // Fire and forget
  }

  return (
    <>
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search simulations..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          
          <Select value={subject} onValueChange={handleSubjectChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              <SelectItem value="Physics">Physics</SelectItem>
              <SelectItem value="Chemistry">Chemistry</SelectItem>
              <SelectItem value="Biology">Biology</SelectItem>
              <SelectItem value="Maths">Maths</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={sort} onValueChange={handleSortChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Most Recent
                </div>
              </SelectItem>
              <SelectItem value="views">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Most Viewed
                </div>
              </SelectItem>
              <SelectItem value="forks">
                <div className="flex items-center gap-2">
                  <GitFork className="h-4 w-4" />
                  Most Forked
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results */}
        {simulations.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Search className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold mb-1">No simulations found</h3>
              <p className="text-muted-foreground text-sm">
                Try adjusting your search or filters
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {simulations.map((sim) => (
              <Card key={sim.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {getIcon(sim.subject)}
                      <CardTitle className="truncate text-base">{sim.title}</CardTitle>
                    </div>
                  </div>
                  <CardDescription className="flex items-center gap-2">
                    <span>{sim.subject}</span>
                    <span>•</span>
                    <span>{getTypeLabel(sim.type)}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">
                    {sim.description || "No description provided."}
                  </p>
                  
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {sim.views}
                    </div>
                    <div className="flex items-center gap-1">
                      <GitFork className="h-3 w-3" />
                      {sim.forks}
                    </div>
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    By {sim.user.name || sim.user.email}
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handlePreview(sim)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleFork(sim.id)}
                      disabled={forking === sim.id}
                    >
                      {forking === sim.id ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Forking...</>
                      ) : (
                        <><GitFork className="mr-2 h-4 w-4" /> Fork</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewSim} onOpenChange={(open) => !open && setPreviewSim(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          {previewSim && (
            <>
              <DialogHeader>
                <DialogTitle>{previewSim.title}</DialogTitle>
                <DialogDescription>
                  <div className="flex items-center gap-4 mt-2">
                    <span>{previewSim.description}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs mt-2">
                    <span>By {previewSim.user.name || previewSim.user.email}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" /> {previewSim.views} views
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <GitFork className="h-3 w-3" /> {previewSim.forks} forks
                    </span>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <div className="overflow-auto max-h-[70vh]">
                <SimulationRunner simulation={previewSim} />
              </div>
              <div className="flex justify-end gap-2">
                <Button 
                  onClick={() => handleFork(previewSim.id)}
                  disabled={forking === previewSim.id}
                >
                  {forking === previewSim.id ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Forking...</>
                  ) : (
                    <><GitFork className="mr-2 h-4 w-4" /> Fork to My Library</>
                  )}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
