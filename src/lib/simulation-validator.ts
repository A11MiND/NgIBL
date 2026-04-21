import type { TaskSignals } from '@/lib/engine-scoring'

export type ValidationCheck = {
  name: 'compile' | 'interaction' | 'fps' | 'learning-goal'
  passed: boolean
  message: string
}

export type ValidationResult = {
  passed: boolean
  checks: ValidationCheck[]
}

function includesAny(text: string, tokens: string[]): boolean {
  const lower = text.toLowerCase()
  return tokens.some((t) => lower.includes(t))
}

export function validateSimulationOutput(params: {
  code: string
  type: 'REACT'
  signals: TaskSignals
}): ValidationResult {
  const checks: ValidationCheck[] = []
  const code = params.code || ''

  const compilePassed = code.includes('export default function') && (code.includes('return (') || code.includes('return('))
  checks.push({
    name: 'compile',
    passed: compilePassed,
    message: compilePassed ? 'React output structure looks valid' : 'Missing component export or return JSX',
  })

  const interactionPassed = includesAny(code, ['Slider', '<button', 'onClick', 'onChange', 'onValueChange'])
  checks.push({
    name: 'interaction',
    passed: interactionPassed,
    message: interactionPassed ? 'Interactive controls detected' : 'No clear interactive controls detected',
  })

  const fpsPassed = !params.signals.requiresCollision || includesAny(code, ['requestAnimationFrame', 'Matter.Engine', 'Runner.run'])
  checks.push({
    name: 'fps',
    passed: fpsPassed,
    message: fpsPassed ? 'Animation/runtime strategy detected' : 'Physics scenario missing runtime animation strategy',
  })

  const goalHint = params.signals.subject
  const learningGoalPassed = includesAny(code, [goalHint, 'label', 'title', 'caption', 'explain'])
  checks.push({
    name: 'learning-goal',
    passed: learningGoalPassed,
    message: learningGoalPassed ? 'Learning goal indicators found' : 'Learning-goal cues are weak in output',
  })

  const passed = checks.every((c) => c.passed)
  return { passed, checks }
}
