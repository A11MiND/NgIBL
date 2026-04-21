import type { TaskSignals } from '@/lib/engine-scoring'

export type VariationProfile = {
  layout: 'compact' | 'split' | 'panel'
  controlDensity: 'low' | 'medium' | 'high'
  visualStyle: 'clean' | 'lab' | 'story'
  pacing: 'guided' | 'explore'
}

function hashString(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0
  }
  return h
}

export function pickVariationProfile(params: {
  prompt: string
  subject: string
  signals: TaskSignals
}): VariationProfile {
  const seed = hashString(`${params.subject}:${params.prompt}:${params.signals.goal}`)

  const layoutOptions: VariationProfile['layout'][] = ['compact', 'split', 'panel']
  const densityOptions: VariationProfile['controlDensity'][] = ['low', 'medium', 'high']
  const styleOptions: VariationProfile['visualStyle'][] = ['clean', 'lab', 'story']
  const pacingOptions: VariationProfile['pacing'][] = ['guided', 'explore']

  return {
    layout: layoutOptions[seed % layoutOptions.length],
    controlDensity: densityOptions[(seed >> 2) % densityOptions.length],
    visualStyle: styleOptions[(seed >> 4) % styleOptions.length],
    pacing: pacingOptions[(seed >> 6) % pacingOptions.length],
  }
}

export function buildVariationContext(profile: VariationProfile): string {
  return [
    '[Variation Layer]',
    `Layout: ${profile.layout}`,
    `Control Density: ${profile.controlDensity}`,
    `Visual Style: ${profile.visualStyle}`,
    `Interaction Pacing: ${profile.pacing}`,
    'Preserve core learning objective and scientific logic; vary only presentation and interaction style.',
  ].join('\n')
}
