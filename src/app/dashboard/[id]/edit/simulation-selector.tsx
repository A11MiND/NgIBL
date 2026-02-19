"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { 
  Library, Users, Plus, Search, Code, Atom, Dna, FlaskConical, 
  BookOpen, Eye, Check 
} from "lucide-react"
import SimulationRunner from "@/components/simulation-runner"
import { Dictionary } from "@/lib/dictionary"

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
  isPublic: boolean
}

interface SimulationSelectorProps {
  mySimulations: Simulation[]
  communitySimulations: Simulation[]
  currentSimulationId?: string | null
  onSelect: (simulation: Simulation) => void
  dict: Dictionary
}

export default function SimulationSelector({
  mySimulations,
  communitySimulations,
  currentSimulationId,
  onSelect,
  dict
}: SimulationSelectorProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [previewSim, setPreviewSim] = useState<Simulation | null>(null)
  const [tab, setTab] = useState<'library' | 'community'>('library')

  const currentSimulation = [...mySimulations, ...communitySimulations]
    .find(s => s.id === currentSimulationId)

  const getIcon = (subject: string) => {
    switch (subject) {
      case "Physics": return <Atom className="h-4 w-4 text-blue-500" />
      case "Chemistry": return <FlaskConical className="h-4 w-4 text-purple-500" />
      case "Biology": return <Dna className="h-4 w-4 text-green-500" />
      case "Math": case "Maths": return <Code className="h-4 w-4 text-orange-500" />
      default: return <BookOpen className="h-4 w-4 text-gray-500" />
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

  const filteredLibrary = mySimulations.filter(s => 
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.description?.toLowerCase().includes(search.toLowerCase())
  )

  const filteredCommunity = communitySimulations.filter(s => 
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.description?.toLowerCase().includes(search.toLowerCase())
  )

  function handleSelect(sim: Simulation) {
    onSelect(sim)
    setOpen(false)
  }

  return (
    <>
      <div className="space-y-4">
        {currentSimulation ? (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getIcon(currentSimulation.subject)}
                  <CardTitle className="text-base">{currentSimulation.title}</CardTitle>
                </div>
                <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
                  {dict.editor.changeSimulation}
                </Button>
              </div>
              <CardDescription>
                {currentSimulation.subject} • {getTypeLabel(currentSimulation.type)}
              </CardDescription>
            </CardHeader>
            {currentSimulation.description && (
              <CardContent>
                <p className="text-sm text-muted-foreground">{currentSimulation.description}</p>
              </CardContent>
            )}
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Library className="h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="font-medium mb-1">{dict.editor.noSimulationSelected}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {dict.editor.noSimulationDesc}
              </p>
              <Button onClick={() => setOpen(true)}>
                <Library className="mr-2 h-4 w-4" />
                {dict.editor.selectSimulation}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{dict.editor.selectSimulation}</DialogTitle>
          </DialogHeader>

          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex-1">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="library">
                <Library className="mr-2 h-4 w-4" />
                {dict.editor.myLibrary} ({mySimulations.length})
              </TabsTrigger>
              <TabsTrigger value="community">
                <Users className="mr-2 h-4 w-4" />
                {dict.nav.community} ({communitySimulations.length})
              </TabsTrigger>
              <TabsTrigger value="create" onClick={() => window.open('/sandbox', '_blank')}>
                <Plus className="mr-2 h-4 w-4" />
                {dict.editor.createNewSim}
              </TabsTrigger>
            </TabsList>

            <div className="mt-4 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={dict.editor.searchSims}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <TabsContent value="library" className="mt-0 max-h-[50vh] overflow-y-auto">
              {filteredLibrary.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {search ? dict.editor.noSimsFound : dict.editor.libraryEmpty}
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {filteredLibrary.map(sim => (
                    <Card key={sim.id} className="cursor-pointer hover:bg-muted/50">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {getIcon(sim.subject)}
                            <CardTitle className="text-sm truncate">{sim.title}</CardTitle>
                            {currentSimulationId === sim.id && (
                              <Check className="h-4 w-4 text-green-600 shrink-0" />
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {sim.description || dict.editor.noDescription}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => setPreviewSim(sim)}
                          >
                            <Eye className="mr-1 h-3 w-3" />
                            {dict.library.preview}
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => handleSelect(sim)}
                          >
                            {dict.editor.selectButton}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="community" className="mt-0 max-h-[50vh] overflow-y-auto">
              {filteredCommunity.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {search ? dict.editor.noSimsFound : dict.community.empty}
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {filteredCommunity.map(sim => (
                    <Card key={sim.id} className="cursor-pointer hover:bg-muted/50">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {getIcon(sim.subject)}
                            <CardTitle className="text-sm truncate">{sim.title}</CardTitle>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {sim.description || dict.editor.noDescription}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => setPreviewSim(sim)}
                          >
                            <Eye className="mr-1 h-3 w-3" />
                            {dict.library.preview}
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => handleSelect(sim)}
                          >
                            {dict.editor.selectButton}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewSim} onOpenChange={(open) => !open && setPreviewSim(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          {previewSim && (
            <>
              <DialogHeader>
                <DialogTitle>{previewSim.title}</DialogTitle>
              </DialogHeader>
              <div className="overflow-auto max-h-[70vh]">
                <SimulationRunner simulation={previewSim} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
