/**
 * Multi-Agent Workflow for Simulation Generation
 * 
 * Implements an orchestrator pattern with specialized agents:
 * 1. Planner Agent — breaks down the simulation into components
 * 2. Code Generator Agent — generates React/GeoGebra code
 * 3. Validator Agent — checks syntax and structure
 * 4. Refiner Agent — fixes errors (self-healing loop, max 3 attempts)
 * 
 * This replaces the single-shot generation with a more reliable pipeline.
 */

import { generateContent, AIProvider } from './ai'
import { logger, logAI } from './logger'

// ─── Types ──────────────────────────────────────────────────────────

interface AgentContext {
  prompt: string
  type: 'REACT' | 'GEOGEBRA'
  plan?: string[]
  code?: string
  errors?: string[]
  attempts: number
  startTime: number
}

interface AgentOptions {
  apiKey: string
  provider: AIProvider
  model?: string
  ollamaBaseUrl?: string
  temperature?: number
  images?: string[]
}

interface AgentResult {
  code: string
  plan: string[]
  attempts: number
  duration: number
}

// ─── System Prompts ─────────────────────────────────────────────────

const PLANNER_PROMPT = `You are a simulation planning agent. Your job is to break down a simulation request into clear, implementable components.

Given a simulation description, output a numbered list of 3-7 implementation steps. Each step should be specific and actionable.

Format:
1. [Component/Feature]: Brief description
2. [Component/Feature]: Brief description
...

Focus on:
- UI layout and controls (sliders, buttons, inputs)
- Visual elements (canvas, SVG, charts)  
- Physics/math calculations
- State management
- User interactions
- Real-time updates/animations

Output ONLY the numbered list, nothing else.`

const VALIDATOR_PROMPT = `You are a code validation agent. Analyze the following code and identify any issues.

Rules for valid code:
1. Must be a complete, self-contained React component
2. Must use only: React, useState, useEffect, useRef, useCallback, useMemo
3. Available libraries: Slider (from scope), recharts (BarChart, LineChart, etc.), lucide-react icons
4. No import statements allowed
5. Must render valid JSX
6. All variables must be defined before use
7. No async operations or fetch calls in the component body

If the code is valid, respond with exactly: VALID
If there are issues, respond with a numbered list of errors.`

// ─── Agent Functions ────────────────────────────────────────────────

/**
 * Planner Agent: Breaks down the simulation into actionable steps.
 */
async function plannerAgent(
  ctx: AgentContext,
  opts: AgentOptions
): Promise<string[]> {
  const startTime = Date.now()

  try {
    const response = await generateContent('', opts.apiKey, opts.provider, {
      model: opts.model,
      ollamaBaseUrl: opts.ollamaBaseUrl,
      temperature: 0.3,
      messages: [
        { role: 'system', content: PLANNER_PROMPT },
        { role: 'user', content: `Create a plan for this ${ctx.type} simulation:\n\n${ctx.prompt}` },
      ],
    })

    const steps = response
      .split('\n')
      .filter(line => /^\d+\./.test(line.trim()))
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .filter(step => step.length > 0)

    logAI('planner_agent', {
      provider: opts.provider,
      model: opts.model,
      duration: Date.now() - startTime,
    })

    return steps.length > 0 ? steps : ['Generate the complete simulation based on the prompt']
  } catch (error) {
    logger.warn({ error }, 'Planner agent failed — using default plan')
    return ['Generate the complete simulation based on the prompt']
  }
}

/**
 * Code Generator Agent: Generates simulation code based on the plan.
 */
async function codeGeneratorAgent(
  ctx: AgentContext,
  opts: AgentOptions,
  systemPrompt: string
): Promise<string> {
  const startTime = Date.now()

  const planContext = ctx.plan && ctx.plan.length > 0
    ? `\n\nImplementation Plan:\n${ctx.plan.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
    : ''

  const response = await generateContent('', opts.apiKey, opts.provider, {
    model: opts.model,
    ollamaBaseUrl: opts.ollamaBaseUrl,
    temperature: opts.temperature ?? 0.7,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `${ctx.prompt}${planContext}`,
      },
    ],
    images: opts.images,
  })

  logAI('code_generator_agent', {
    provider: opts.provider,
    model: opts.model,
    duration: Date.now() - startTime,
  })

  return response
}

/**
 * Validator Agent: Checks the generated code for issues.
 */
async function validatorAgent(
  code: string,
  type: 'REACT' | 'GEOGEBRA',
  opts: AgentOptions
): Promise<{ valid: boolean; errors: string[] }> {
  // For GeoGebra, just check if it's valid JSON
  if (type === 'GEOGEBRA') {
    try {
      JSON.parse(code)
      return { valid: true, errors: [] }
    } catch {
      return { valid: false, errors: ['Invalid JSON format'] }
    }
  }

  // For React: do a quick syntax check locally first
  const syntaxErrors = quickSyntaxCheck(code)
  if (syntaxErrors.length > 0) {
    return { valid: false, errors: syntaxErrors }
  }

  // Then use AI for semantic validation
  try {
    const response = await generateContent('', opts.apiKey, opts.provider, {
      model: opts.model,
      ollamaBaseUrl: opts.ollamaBaseUrl,
      temperature: 0.1,
      messages: [
        { role: 'system', content: VALIDATOR_PROMPT },
        { role: 'user', content: `Validate this React component code:\n\n\`\`\`jsx\n${code}\n\`\`\`` },
      ],
    })

    if (response.trim().toUpperCase() === 'VALID') {
      return { valid: true, errors: [] }
    }

    const errors = response
      .split('\n')
      .filter(line => line.trim().length > 0 && !line.startsWith('#'))
      .map(line => line.replace(/^\d+\.\s*/, '').trim())

    return { valid: errors.length === 0, errors }
  } catch {
    // If validator fails, assume code is OK (don't block on validator errors)
    return { valid: true, errors: [] }
  }
}

/**
 * Refiner Agent: Fixes code based on error feedback.
 */
async function refinerAgent(
  ctx: AgentContext,
  opts: AgentOptions,
  systemPrompt: string
): Promise<string> {
  const startTime = Date.now()

  const response = await generateContent('', opts.apiKey, opts.provider, {
    model: opts.model,
    ollamaBaseUrl: opts.ollamaBaseUrl,
    temperature: 0.3, // Lower temperature for more precise fixes
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `The following code has errors. Fix them while keeping the same functionality.\n\nCode:\n\`\`\`\n${ctx.code}\n\`\`\`\n\nErrors:\n${ctx.errors?.join('\n')}\n\nProvide ONLY the fixed code.`,
      },
    ],
  })

  logAI('refiner_agent', {
    provider: opts.provider,
    model: opts.model,
    duration: Date.now() - startTime,
  })

  return response
}

// ─── Quick Syntax Check ─────────────────────────────────────────────

/**
 * Fast local syntax checks without using AI.
 */
function quickSyntaxCheck(code: string): string[] {
  const errors: string[] = []

  // Check for balanced braces/brackets/parens
  const pairs: Record<string, string> = { '{': '}', '[': ']', '(': ')' }
  const stack: string[] = []
  let inString = false
  let stringChar = ''

  for (let i = 0; i < code.length; i++) {
    const ch = code[i]
    const prev = i > 0 ? code[i - 1] : ''

    if (inString) {
      if (ch === stringChar && prev !== '\\') inString = false
      continue
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true
      stringChar = ch
      continue
    }

    if (ch in pairs) {
      stack.push(pairs[ch])
    } else if (ch === '}' || ch === ']' || ch === ')') {
      if (stack.length === 0 || stack.pop() !== ch) {
        errors.push(`Unmatched '${ch}' at position ${i}`)
        break
      }
    }
  }

  if (stack.length > 0) {
    errors.push(`Unclosed brackets: expected ${stack.reverse().join(', ')}`)
  }

  // Check for forbidden patterns
  if (code.includes('import ') && !code.includes('// import')) {
    errors.push('Import statements are not allowed — all libraries are provided via scope')
  }

  // Check for required return/render
  if (!code.includes('return') && !code.includes('return(')) {
    errors.push('Component must have a return statement with JSX')
  }

  return errors
}

// ─── Orchestrator ───────────────────────────────────────────────────

/**
 * Main orchestrator: runs the full multi-agent pipeline.
 * 
 * Flow:
 * 1. Plan → 2. Generate → 3. Validate → 4. Refine (repeat up to 3x)
 */
export async function agentGenerateSimulation(
  prompt: string,
  type: 'REACT' | 'GEOGEBRA',
  systemPrompt: string,
  extractCode: (raw: string, type: string) => string,
  options: AgentOptions
): Promise<AgentResult> {
  const ctx: AgentContext = {
    prompt,
    type,
    attempts: 0,
    startTime: Date.now(),
  }

  logger.info({ prompt: prompt.substring(0, 100), type }, 'Agent pipeline started')

  // Step 1: Planning
  ctx.plan = await plannerAgent(ctx, options)
  logger.debug({ plan: ctx.plan }, 'Plan generated')

  // Step 2: Code Generation
  const rawCode = await codeGeneratorAgent(ctx, options, systemPrompt)
  ctx.code = extractCode(rawCode, type)

  // Step 3 & 4: Validate + Refine loop
  const MAX_ATTEMPTS = 3
  while (ctx.attempts < MAX_ATTEMPTS) {
    const validation = await validatorAgent(ctx.code!, type, options)

    if (validation.valid) {
      logger.info({
        attempts: ctx.attempts,
        duration: Date.now() - ctx.startTime,
      }, 'Agent pipeline completed successfully')

      return {
        code: ctx.code!,
        plan: ctx.plan!,
        attempts: ctx.attempts,
        duration: Date.now() - ctx.startTime,
      }
    }

    // Needs refinement
    ctx.errors = validation.errors
    ctx.attempts++
    logger.info({ attempt: ctx.attempts, errors: ctx.errors }, 'Refining code')

    const refinedRaw = await refinerAgent(ctx, options, systemPrompt)
    ctx.code = extractCode(refinedRaw, type)
  }

  // Max attempts reached — return best effort
  logger.warn({
    attempts: ctx.attempts,
    duration: Date.now() - ctx.startTime,
  }, 'Agent pipeline: max refinement attempts reached')

  return {
    code: ctx.code!,
    plan: ctx.plan!,
    attempts: ctx.attempts,
    duration: Date.now() - ctx.startTime,
  }
}
