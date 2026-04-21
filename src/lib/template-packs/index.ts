import type { EngineId, EngineRoutingResult, TaskSignals } from '@/lib/engine-scoring'

export type TemplatePack = {
  id: string
  engine: EngineId
  title: string
  visualStyle: 'minimal' | 'lab' | 'dashboard' | 'story'
  interactionPattern: 'slider-first' | 'drag-first' | 'step-by-step' | 'free-explore'
  knowledgeTags: string[]
  promptPrefix: string
}

const TEMPLATE_PACKS: TemplatePack[] = [
  {
    id: 'matter-newton-lab',
    engine: 'matter',
    title: 'Newton Dynamics Lab',
    visualStyle: 'lab',
    interactionPattern: 'slider-first',
    knowledgeTags: ['physics', 'force', 'mass', 'acceleration'],
    promptPrefix: 'Use Matter.js and build a Newtonian dynamics lab with clear controls for force, mass, and friction.',
  },
  {
    id: 'matter-collision-arena',
    engine: 'matter',
    title: 'Collision Arena',
    visualStyle: 'dashboard',
    interactionPattern: 'free-explore',
    knowledgeTags: ['physics', 'collision', 'momentum', 'restitution'],
    promptPrefix: 'Use Matter.js to build a collision arena with adjustable restitution, mass, and initial velocity.',
  },
  {
    id: 'matter-projectile-trainer',
    engine: 'matter',
    title: 'Projectile Trainer',
    visualStyle: 'story',
    interactionPattern: 'step-by-step',
    knowledgeTags: ['physics', 'projectile', 'gravity'],
    promptPrefix: 'Use Matter.js to build a projectile trainer with launch angle and speed controls and trajectory explanation.',
  },
  {
    id: 'jsxgraph-geometry-studio',
    engine: 'jsxgraph',
    title: 'Geometry Studio',
    visualStyle: 'minimal',
    interactionPattern: 'drag-first',
    knowledgeTags: ['math', 'geometry', 'construction'],
    promptPrefix: 'Use JSXGraph to build a draggable geometry studio with visible constraints and measurements.',
  },
  {
    id: 'jsxgraph-function-lab',
    engine: 'jsxgraph',
    title: 'Function Transformation Lab',
    visualStyle: 'dashboard',
    interactionPattern: 'slider-first',
    knowledgeTags: ['math', 'function', 'graph', 'transform'],
    promptPrefix: 'Use JSXGraph to build a function transformation lab with sliders for parameters and dynamic graph updates.',
  },
  {
    id: 'jsxgraph-locus-explorer',
    engine: 'jsxgraph',
    title: 'Locus Explorer',
    visualStyle: 'lab',
    interactionPattern: 'free-explore',
    knowledgeTags: ['math', 'locus', 'draggable'],
    promptPrefix: 'Use JSXGraph to build a locus explorer with draggable control points and traced geometric paths.',
  },
  {
    id: 'kekule-structure-builder',
    engine: 'kekule',
    title: 'Molecule Structure Builder',
    visualStyle: 'minimal',
    interactionPattern: 'drag-first',
    knowledgeTags: ['chemistry', 'molecule', 'structure'],
    promptPrefix: 'Use Kekule.js to build a structure builder where users create and inspect molecules interactively.',
  },
  {
    id: 'kekule-reaction-workbench',
    engine: 'kekule',
    title: 'Reaction Workbench',
    visualStyle: 'lab',
    interactionPattern: 'step-by-step',
    knowledgeTags: ['chemistry', 'reaction', 'equation'],
    promptPrefix: 'Use Kekule.js to build a reaction workbench that guides learners through reactants to products.',
  },
  {
    id: '3dmol-protein-viewer',
    engine: '3dmol',
    title: 'Protein Viewer',
    visualStyle: 'story',
    interactionPattern: 'free-explore',
    knowledgeTags: ['chemistry', '3d molecule', 'protein', 'pdb'],
    promptPrefix: 'Use 3Dmol.js to build a protein viewer with style toggles and annotation overlays.',
  },
  {
    id: '3dmol-molecule-comparison',
    engine: '3dmol',
    title: 'Molecule Comparison',
    visualStyle: 'dashboard',
    interactionPattern: 'step-by-step',
    knowledgeTags: ['chemistry', '3d molecule', 'comparison'],
    promptPrefix: 'Use 3Dmol.js to build a side-by-side molecule comparison experience with synchronized view controls.',
  },
  {
    id: 'react-general-experiment',
    engine: 'react',
    title: 'General Interactive Experiment',
    visualStyle: 'lab',
    interactionPattern: 'slider-first',
    knowledgeTags: ['general', 'simulation', 'interactive'],
    promptPrefix: 'Use React to build a clean interactive experiment with explicit controls and explainable outputs.',
  },
]

function scoreTemplate(pack: TemplatePack, signals: TaskSignals): number {
  let score = 0
  if (pack.knowledgeTags.includes(signals.subject)) score += 2
  if (signals.requiresCollision && pack.knowledgeTags.includes('collision')) score += 2
  if (signals.requiresDraggableGeometry && pack.knowledgeTags.includes('draggable')) score += 2
  if (signals.requires3DMolecule && (pack.knowledgeTags.includes('3d molecule') || pack.knowledgeTags.includes('protein'))) score += 2
  return score
}

export function selectTemplatePack(params: {
  route: EngineRoutingResult
  excludedTemplateIds?: string[]
}): TemplatePack | null {
  const excluded = new Set(params.excludedTemplateIds || [])
  const candidates = TEMPLATE_PACKS.filter(
    (pack) => pack.engine === params.route.primaryEngine && !excluded.has(pack.id)
  )
  if (candidates.length === 0) return null

  const scored = candidates
    .map((pack) => ({ pack, score: scoreTemplate(pack, params.route.signals) }))
    .sort((a, b) => b.score - a.score)

  return scored[0].pack
}

export function selectTemplateForEngine(engine: EngineId, signals: TaskSignals): TemplatePack | null {
  const candidates = TEMPLATE_PACKS.filter((pack) => pack.engine === engine)
  if (candidates.length === 0) return null
  const scored = candidates
    .map((pack) => ({ pack, score: scoreTemplate(pack, signals) }))
    .sort((a, b) => b.score - a.score)
  return scored[0].pack
}

export function buildTemplatePromptContext(pack: TemplatePack | null): string {
  if (!pack) return ''
  return [
    '[Template Pack]',
    `Template ID: ${pack.id}`,
    `Title: ${pack.title}`,
    `Visual Style: ${pack.visualStyle}`,
    `Interaction Pattern: ${pack.interactionPattern}`,
    `Guidance: ${pack.promptPrefix}`,
  ].join('\n')
}

export function listTemplatePacksByEngine(engine: EngineId): TemplatePack[] {
  return TEMPLATE_PACKS.filter((pack) => pack.engine === engine)
}
