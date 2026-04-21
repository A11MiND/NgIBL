export type SubjectSignal = 'physics' | 'math' | 'chemistry' | 'biology' | 'general'

export type EngineId = 'matter' | 'jsxgraph' | 'kekule' | '3dmol' | 'react'

export type TaskSignals = {
  subject: SubjectSignal
  goal: string
  requiresCollision: boolean
  requiresDraggableGeometry: boolean
  requires3DMolecule: boolean
}

export type EngineScore = {
  engine: EngineId
  score: number
  reasons: string[]
}

export type EngineRoutingResult = {
  signals: TaskSignals
  primaryEngine: EngineId
  alternatives: EngineId[]
  fallbackChain: EngineId[]
  scoredEngines: EngineScore[]
}

const ENGINE_BASE_SCORE: Record<EngineId, number> = {
  matter: 0.5,
  jsxgraph: 0.5,
  kekule: 0.5,
  '3dmol': 0.5,
  react: 0.6,
}

function inferSubject(subject: string): SubjectSignal {
  const lower = subject.toLowerCase()
  if (lower.includes('physic')) return 'physics'
  if (lower.includes('math') || lower.includes('geometry') || lower.includes('algebra') || lower.includes('calculus')) return 'math'
  if (lower.includes('chem')) return 'chemistry'
  if (lower.includes('bio')) return 'biology'
  return 'general'
}

function keywordIncludes(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase()
  return keywords.some((k) => lower.includes(k))
}

export function detectTaskSignals(input: {
  subject: string
  prompt: string
  goal?: string
  requiresCollision?: boolean
  requiresDraggableGeometry?: boolean
  requires3DMolecule?: boolean
}): TaskSignals {
  const subject = inferSubject(input.subject)
  const prompt = input.prompt || ''

  const inferredCollision = keywordIncludes(prompt, [
    'collision', 'bounce', 'bouncing', 'rigid body', 'rigid-body', 'gravity', 'projectile', 'friction', 'momentum',
  ])
  const inferredDraggableGeometry = keywordIncludes(prompt, [
    'draggable', 'drag', 'geometry', 'geometric construction', 'locus', 'coordinate plane', 'triangle',
  ])
  const inferred3DMolecule = keywordIncludes(prompt, [
    '3d molecule', '3d molecular', 'molecule model', 'protein', 'pdb', 'ball-and-stick', 'space-filling',
  ])

  return {
    subject,
    goal: input.goal?.trim() || prompt.trim() || 'Build an interactive experiment simulation',
    requiresCollision: input.requiresCollision ?? inferredCollision,
    requiresDraggableGeometry: input.requiresDraggableGeometry ?? inferredDraggableGeometry,
    requires3DMolecule: input.requires3DMolecule ?? inferred3DMolecule,
  }
}

function pushReason(reasons: string[], reason: string): void {
  if (!reasons.includes(reason)) reasons.push(reason)
}

export function scoreEngines(signals: TaskSignals): EngineScore[] {
  const scores: Record<EngineId, EngineScore> = {
    matter: { engine: 'matter', score: ENGINE_BASE_SCORE.matter, reasons: [] },
    jsxgraph: { engine: 'jsxgraph', score: ENGINE_BASE_SCORE.jsxgraph, reasons: [] },
    kekule: { engine: 'kekule', score: ENGINE_BASE_SCORE.kekule, reasons: [] },
    '3dmol': { engine: '3dmol', score: ENGINE_BASE_SCORE['3dmol'], reasons: [] },
    react: { engine: 'react', score: ENGINE_BASE_SCORE.react, reasons: [] },
  }

  if (signals.subject === 'physics') {
    scores.matter.score += 1.3
    pushReason(scores.matter.reasons, 'Physics subject favors rigid-body simulation')
    scores.react.score += 0.4
    pushReason(scores.react.reasons, 'React runtime supports flexible physics UI')
  }

  if (signals.subject === 'math') {
    scores.jsxgraph.score += 1.2
    pushReason(scores.jsxgraph.reasons, 'Math subject favors interactive geometry/graphing')
  }

  if (signals.subject === 'chemistry') {
    scores.kekule.score += 1.1
    pushReason(scores.kekule.reasons, 'Chemistry subject favors structure/editor interactions')
    scores['3dmol'].score += 0.9
    pushReason(scores['3dmol'].reasons, 'Chemistry subject can benefit from 3D molecular visualization')
  }

  if (signals.requiresCollision) {
    scores.matter.score += 1.6
    pushReason(scores.matter.reasons, 'Collision requirement strongly matches Matter.js')
  }

  if (signals.requiresDraggableGeometry) {
    scores.jsxgraph.score += 1.3
    pushReason(scores.jsxgraph.reasons, 'Draggable geometry requirement matches JSXGraph')
  }

  if (signals.requires3DMolecule) {
    scores['3dmol'].score += 1.8
    pushReason(scores['3dmol'].reasons, '3D molecular requirement strongly matches 3Dmol.js')
    scores.kekule.score += 0.5
    pushReason(scores.kekule.reasons, 'Kekule can complement molecular workflows')
  }

  return Object.values(scores).sort((a, b) => b.score - a.score)
}

export function routeEngines(signals: TaskSignals): EngineRoutingResult {
  const scoredEngines = scoreEngines(signals)
  const primaryEngine = scoredEngines[0].engine
  const alternatives = scoredEngines.slice(1, 3).map((s) => s.engine)
  const fallbackChain = scoredEngines.slice(1).map((s) => s.engine)

  return {
    signals,
    primaryEngine,
    alternatives,
    fallbackChain,
    scoredEngines,
  }
}

export function mapEngineToSimulationType(engine: EngineId): 'REACT' {
  void engine
  return 'REACT'
}
