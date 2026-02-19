import { generateContent, AIProvider } from './ai'

/**
 * Robustly extract code from AI response that may contain markdown, explanations, etc.
 */
function extractCode(raw: string, type: 'REACT' | 'GEOGEBRA_API'): string {
  let text = raw.trim()
  
  if (type === 'GEOGEBRA_API') {
    // Extract JSON object from response
    const jsonMatch = text.match(/\{[\s\S]*"commands"[\s\S]*\}/)
    if (jsonMatch) {
      try {
        JSON.parse(jsonMatch[0]) // validate
        return jsonMatch[0]
      } catch {
        // Try to fix common JSON issues
        const fixed = jsonMatch[0]
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']')
        try {
          JSON.parse(fixed)
          return fixed
        } catch { /* fall through */ }
      }
    }
    return text
  }
  
  // REACT type: extract code from markdown or mixed response
  
  // 1. If wrapped in code fences, extract the content
  const fenceMatch = text.match(/```(?:jsx|tsx|javascript|typescript|react)?\s*\n([\s\S]*?)```/)
  if (fenceMatch) {
    text = fenceMatch[1].trim()
  }
  
  // 2. If there's explanation text before "export default", strip it
  const exportIdx = text.indexOf('export default function')
  if (exportIdx > 0) {
    // Check if there's significant non-code text before export
    const before = text.substring(0, exportIdx).trim()
    // If the text before looks like prose (contains multiple sentences), strip it
    if (before.includes('.') && before.length > 50 && !before.includes('const ') && !before.includes('function ')) {
      text = text.substring(exportIdx)
    }
  }
  
  // 3. If there's explanation text after the last closing brace of the component, strip it
  // Find the matching closing brace for export default function
  if (text.includes('export default function')) {
    let depth = 0
    let lastBrace = -1
    const startIdx = text.indexOf('{', text.indexOf('export default function'))
    
    if (startIdx !== -1) {
      for (let i = startIdx; i < text.length; i++) {
        if (text[i] === '{') depth++
        if (text[i] === '}') {
          depth--
          if (depth === 0) {
            lastBrace = i
            break
          }
        }
      }
      if (lastBrace !== -1 && lastBrace < text.length - 1) {
        const after = text.substring(lastBrace + 1).trim()
        // If there's significant text after that looks like prose, strip it
        if (after.length > 10) {
          text = text.substring(0, lastBrace + 1)
        }
      }
    }
  }
  
  // 4. Final cleanup: remove any remaining fence markers, import statements
  text = text
    .replace(/^```(?:jsx|tsx|javascript|typescript|react)?\s*/gm, '')
    .replace(/```\s*$/gm, '')
    .replace(/^import\s+[\s\S]*?from\s+['"].*?['"];?\s*$/gm, '')
    .trim()
  
  return text
}

/**
 * System prompts for different simulation types
 */

const REACT_SYSTEM_PROMPT = `You are an expert React developer creating interactive educational simulations.

OUTPUT FORMAT:
- Return ONLY valid JSX code. No markdown, no explanations, no \`\`\` fences.
- Must start with: export default function ComponentName() {
- Do NOT write import statements. All dependencies are pre-loaded in scope.

AVAILABLE (already in scope — do NOT import):
- React: React, useState, useEffect, useRef, useCallback, useMemo, useReducer, createContext, useContext, memo, forwardRef, Fragment
- UI: Button, Card, CardContent, CardHeader, CardTitle, CardDescription, Input, Label, Slider
- Charts (Recharts): LineChart, BarChart, AreaChart, ScatterChart, Line, Bar, Area, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
- Icons (Lucide): Play, Pause, RotateCcw, Plus, Minus, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RefreshCw, Info, Check, X, Zap, Thermometer, Sun, Moon, Atom, Eye, EyeOff, AlertCircle, Sparkles, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Settings, Droplets, Wind, FlaskConical, Ruler, Timer, Volume2, VolumeX, HelpCircle
- Animation: motion (framer-motion-like, e.g. <motion.div animate={{x: 100}}>)
- Globals: Math, JSON, console, setTimeout, setInterval, requestAnimationFrame, cancelAnimationFrame, document, window, parseInt, parseFloat

SLIDER API (important — not standard HTML):
<Slider min={0} max={100} step={1} value={[val]} onValueChange={([v]) => setVal(v)} />

CRITICAL RULES:
1. Keep code SHORT and SIMPLE. Avoid overly complex UIs. Focus on the core simulation logic.
2. For canvas simulations: ALWAYS call a draw/render function on mount with useEffect(() => { draw(); }, []).
3. Do NOT use min-h-screen or full-page layouts. Container should fit within preview area (max height ~500px).
4. Use simple controls: a few sliders and buttons, not complex forms.
5. Prefer standard HTML <button> elements over the Button component for simplicity.
6. For physics: store position/velocity in useRef, use requestAnimationFrame for animation.
7. ALWAYS render the initial state immediately on mount — don't wait for Play to be clicked.
8. Keep the component under 150 lines total. Simpler is better.

EXAMPLE CANVAS PATTERN:
export default function MySim() {
  const canvasRef = useRef(null);
  const [value, setValue] = useState(50);
  
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw based on current state
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(value, 50, 40, 40);
  }, [value]);
  
  useEffect(() => { draw(); }, [draw]); // CRITICAL: render on mount and when value changes
  
  return (
    <div className="p-4 space-y-4">
      <canvas ref={canvasRef} width={400} height={200} className="border rounded w-full bg-white" />
      <Slider min={0} max={360} value={[value]} onValueChange={([v]) => setValue(v)} />
    </div>
  );
}`

const GEOGEBRA_SYSTEM_PROMPT = `You are a GeoGebra command generator for educational mathematics.

CRITICAL: Output ONLY valid JSON. No explanations, no markdown fences, no text before or after.

RULES:
1. Use simple variable names (single letters or short words, no special characters)
2. Define all variables before using them
3. Use Slider() to create interactive controls
4. Test each command mentally - if a variable is referenced, it must be defined earlier in the list
5. Keep commands simple and avoid complex nested expressions

AVAILABLE COMMANDS:
- Points: "A = (x, y)"
- Functions: "f(x) = expression"  
- Sliders: "a = Slider(min, max, increment)"
- Circles: "c = Circle(A, r)"
- Lines: "line1 = Line(A, B)"
- Segments: "seg1 = Segment(A, B)"
- Colors: "SetColor(objectName, r, g, b)" where r,g,b are 0-255
- Labels: "SetCaption(objectName, \\"text\\")"  
- Visibility: "SetVisible(objectName, true)"
- Text: "text1 = Text(\\"label\\", (x, y))"

EXAMPLE OUTPUT (this exact format):
{
  "commands": [
    "a = Slider(0.1, 5, 0.1)",
    "b = Slider(-5, 5, 0.1)",
    "c = Slider(-5, 5, 0.1)",
    "f(x) = a*x^2 + b*x + c",
    "SetColor(f, 0, 0, 255)",
    "SetCaption(a, \\"Amplitude\\")"
  ],
  "settings": {
    "width": 800,
    "height": 600,
    "showToolBar": false,
    "showAlgebraInput": true,
    "showMenuBar": false
  }
}

Output ONLY the JSON object. Nothing else.`

interface GenerateOptions {
  temperature?: number
  provider?: AIProvider
  model?: string
  ollamaBaseUrl?: string
  images?: string[]
}

/**
 * Generate a new simulation from a text prompt
 */
export async function generateSimulation(
  prompt: string,
  type: 'REACT' | 'GEOGEBRA_API',
  apiKey: string,
  options: GenerateOptions = {}
): Promise<{ success: boolean; code?: string; error?: string }> {
  try {
    const systemPrompt = type === 'REACT' ? REACT_SYSTEM_PROMPT : GEOGEBRA_SYSTEM_PROMPT
    
    const provider = options.provider || 'deepseek'

    // If images are provided, add vision context to the user prompt
    const userContent = options.images && options.images.length > 0
      ? `${prompt}\n\n[The user has attached ${options.images.length} image(s). Please analyze the image(s) and generate a simulation based on what you see, combined with the text description above.]`
      : prompt

    const code = await generateContent('', apiKey, provider, {
      temperature: options.temperature ?? 0.7,
      model: options.model,
      ollamaBaseUrl: options.ollamaBaseUrl,
      images: options.images,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ]
    })
    
    return { success: true, code: extractCode(code, type) }
  } catch (error: any) {
    console.error('AI generation error:', error)
    return {
      success: false,
      error: error.message || 'Failed to generate simulation'
    }
  }
}

/**
 * Refine an existing simulation with a new instruction
 */
export async function refineSimulation(
  currentCode: string,
  instruction: string,
  type: 'REACT' | 'GEOGEBRA_API',
  apiKey: string,
  options: GenerateOptions = {}
): Promise<{ success: boolean; code?: string; error?: string }> {
  try {
    const systemPrompt = type === 'REACT' ? REACT_SYSTEM_PROMPT : GEOGEBRA_SYSTEM_PROMPT
    
    const provider = options.provider || 'deepseek'
    const code = await generateContent('', apiKey, provider, {
      temperature: options.temperature ?? 0.7,
      model: options.model,
      ollamaBaseUrl: options.ollamaBaseUrl,
      images: options.images,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Current ${type === 'REACT' ? 'code' : 'commands'}:\n\n${currentCode}` },
        { role: 'user', content: `Modify it: ${instruction}\n\nIMPORTANT: Reply with ONLY the complete updated code/JSON. No explanations, no markdown.` }
      ]
    })
    
    return { success: true, code: extractCode(code, type) }
  } catch (error: any) {
    console.error('AI refinement error:', error)
    return {
      success: false,
      error: error.message || 'Failed to refine simulation'
    }
  }
}

/**
 * Attempt to fix errors in simulation code
 */
export async function healSimulation(
  code: string,
  error: string,
  type: 'REACT' | 'GEOGEBRA_API',
  apiKey: string,
  options: GenerateOptions = {}
): Promise<{ success: boolean; code?: string; error?: string }> {
  try {
    const systemPrompt = type === 'REACT' ? REACT_SYSTEM_PROMPT : GEOGEBRA_SYSTEM_PROMPT
    
    const healPrompt = `This ${type === 'REACT' ? 'React code' : 'GeoGebra command set'} has an error. Fix it.

${type === 'REACT' ? 'Code' : 'Commands'}:
${code}

Error:
${error}

CRITICAL: Return ONLY the complete fixed ${type === 'REACT' ? 'component code (export default function ... )' : 'JSON object'}. No explanations. No markdown fences. No text before or after the code.`

    const provider = options.provider || 'deepseek'
    const fixed = await generateContent('', apiKey, provider, {
      temperature: 0.3,
      model: options.model,
      ollamaBaseUrl: options.ollamaBaseUrl,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: healPrompt }
      ]
    })
    
    return { success: true, code: extractCode(fixed, type) }
  } catch (error: any) {
    console.error('AI healing error:', error)
    return {
      success: false,
      error: error.message || 'Failed to fix simulation'
    }
  }
}

/**
 * Auto-generate a description for a simulation based on its code.
 */
export async function generateDescription(
  code: string,
  subject: string,
  apiKey: string,
  options: GenerateOptions = {}
): Promise<{ success: boolean; description?: string; error?: string }> {
  try {
    const provider = options.provider || 'deepseek'
    const result = await generateContent('', apiKey, provider, {
      temperature: 0.5,
      model: options.model,
      ollamaBaseUrl: options.ollamaBaseUrl,
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Summarize the following simulation code in 1-2 concise sentences for a teacher audience. State what the simulation does and what concepts it demonstrates. Reply with ONLY the description text, no quotes, no prefix.' },
        { role: 'user', content: `Subject: ${subject}\n\nCode:\n${code.substring(0, 3000)}` }
      ]
    })
    return { success: true, description: result.trim() }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * AI-powered analysis of student answers for a set of questions.
 */
export async function analyzeStudentAnswers(
  questionsAndAnswers: Array<{
    question: string
    type: string
    answers: string[]
  }>,
  subject: string,
  apiKey: string,
  options: GenerateOptions = {}
): Promise<{ success: boolean; analysis?: string; error?: string }> {
  try {
    const provider = options.provider || 'deepseek'

    const qaText = questionsAndAnswers.map((q, i) => {
      return `Question ${i + 1} (${q.type}): ${q.question}\nStudent Answers:\n${q.answers.map((a, j) => `  ${j + 1}. ${a}`).join('\n')}`
    }).join('\n\n')

    const result = await generateContent('', apiKey, provider, {
      temperature: 0.4,
      model: options.model,
      ollamaBaseUrl: options.ollamaBaseUrl,
      messages: [
        {
          role: 'system',
          content: `You are an expert education analyst. Analyze student responses to a ${subject} experiment. For EACH question, provide:
1. **Common Correct Patterns** - frequent correct answer themes
2. **Common Misconceptions** - frequent incorrect patterns and likely reasoning
3. **Approximate Correctness** - rough percentage of students who seem to understand
4. **Teaching Suggestions** - specific recommendations for the teacher

Use markdown formatting. Be concise and actionable. Write in English.`
        },
        { role: 'user', content: qaText }
      ]
    })
    return { success: true, analysis: result }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * AI-powered analysis of an individual student's answers,
 * with class-level context for comparison.
 */
export async function analyzeIndividualStudent(
  studentName: string,
  studentAnswers: Array<{
    question: string
    type: string
    studentAnswer: string
    allClassAnswers: string[]
  }>,
  subject: string,
  apiKey: string,
  options: GenerateOptions = {}
): Promise<{ success: boolean; analysis?: string; error?: string }> {
  try {
    const provider = options.provider || 'deepseek'

    const qaText = studentAnswers.map((q, i) => {
      return `Question ${i + 1} (${q.type}): ${q.question}
Student's Answer: ${q.studentAnswer}
All Class Answers (for context): ${q.allClassAnswers.slice(0, 20).join(' | ')}`
    }).join('\n\n')

    const result = await generateContent('', apiKey, provider, {
      temperature: 0.4,
      model: options.model,
      ollamaBaseUrl: options.ollamaBaseUrl,
      messages: [
        {
          role: 'system',
          content: `You are an expert education analyst. Analyze ONE student's responses to a ${subject} experiment, comparing against their class's answers.

For EACH question, provide:
1. **Assessment** - Is the answer correct/partially correct/incorrect? Brief explanation.
2. **Class Comparison** - How does this student compare to the class overall?
3. **Misconception** - If wrong, what misconception might the student have?

Then provide an **Overall Summary**:
- Student's strengths
- Areas needing improvement
- Personalized learning suggestions

Use markdown formatting. Be concise, supportive, and constructive. Address the student as "${studentName}".`
        },
        { role: 'user', content: qaText }
      ]
    })
    return { success: true, analysis: result }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Detect controllable variables from React code (optimized)
 */
export function detectVariables(code: string): Array<{
  name: string
  type: 'number' | 'boolean' | 'string'
  defaultValue?: any
  min?: number
  max?: number
}> {
  const variables: Array<any> = []
  
  // Optimized regex - only search in first 10000 chars
  const searchCode = code.substring(0, Math.min(10000, code.length))
  
  // Single pass: extract all useState calls
  const stateRegex = /const\s+\[(\w+),\s*set\w+\]\s*=\s*useState\(([^)]+)\)/g
  
  let match
  const seenNames = new Set<string>()
  
  while ((match = stateRegex.exec(searchCode)) !== null) {
    const [, name, defaultValueStr] = match
    
    // Skip duplicates
    if (seenNames.has(name)) continue
    seenNames.add(name)
    
    let defaultValue: any = defaultValueStr.trim()
    let type: 'number' | 'boolean' | 'string' = 'string'
    
    // Fast type detection
    if (defaultValue === 'true') {
      type = 'boolean'
      defaultValue = true
    } else if (defaultValue === 'false') {
      type = 'boolean'
      defaultValue = false
    } else {
      const numVal = Number(defaultValue)
      if (!isNaN(numVal)) {
        type = 'number'
        defaultValue = numVal
      }
    }
    
    // Quick range search - only in nearby context
    const varEndIdx = Math.min(searchCode.indexOf('\n\n') || searchCode.length, searchCode.length)
    const rangeRegex = new RegExp(
      `value={${name}}[^>]*?(?:min|max)=["']([^"']+)["']`,
      'i'
    )
    let minVal, maxVal
    let rangeMatch
    const contextStart = Math.max(0, searchCode.lastIndexOf('useState', searchCode.indexOf(name)) - 500)
    const contextEnd = Math.min(searchCode.length, searchCode.indexOf('useState', contextStart + 100) + 1000)
    const rangeContext = searchCode.substring(contextStart, contextEnd)
    
    while ((rangeMatch = rangeRegex.exec(rangeContext)) !== null) {
      const val = Number(rangeMatch[1])
      if (!isNaN(val)) {
        if (rangeMatch[0].includes('min')) minVal = val
        else maxVal = val
      }
    }
    
    variables.push({
      name,
      type,
      defaultValue,
      ...(minVal !== undefined && { min: minVal }),
      ...(maxVal !== undefined && { max: maxVal })
    })
  }
  
  return variables
}
