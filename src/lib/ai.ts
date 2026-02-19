// @ts-ignore
import { GoogleGenAI } from "@google/genai";
import { GoogleGenerativeAI } from "@google/generative-ai";

export type AIProvider = 'gemini' | 'deepseek' | 'qwen' | 'ollama';

// Base URLs for OpenAI-compatible providers
const PROVIDER_URLS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com',
  qwen: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
};

const DEFAULT_MODELS: Record<string, string> = {
  deepseek: 'deepseek-chat',
  qwen: 'qwen-turbo',
  ollama: 'llama3',
  gemini: 'gemini-1.5-flash',
};

/**
 * Convert base64 data-url images into OpenAI vision content parts.
 * Also supports plain http(s) URLs.
 */
function buildImageContentParts(text: string, images: string[]): any[] {
  const parts: any[] = [];
  for (const img of images) {
    if (img.startsWith('data:')) {
      parts.push({ type: 'image_url', image_url: { url: img } });
    } else {
      parts.push({ type: 'image_url', image_url: { url: img } });
    }
  }
  parts.push({ type: 'text', text });
  return parts;
}

/**
 * Inject images into the last user message for vision models.
 * Mutates a copy of the messages array.
 */
function injectImagesIntoMessages(messages: any[], images: string[]): any[] {
  if (!images || images.length === 0) return messages;
  const cloned = messages.map((m: any) => ({ ...m }));
  // Find the last user message and convert content to multipart
  for (let i = cloned.length - 1; i >= 0; i--) {
    if (cloned[i].role === 'user') {
      const text = typeof cloned[i].content === 'string' ? cloned[i].content : '';
      cloned[i].content = buildImageContentParts(text, images);
      break;
    }
  }
  return cloned;
}

/**
 * Shared OpenAI-compatible chat completions call.
 * Works for DeepSeek, Qwen (DashScope), and Ollama.
 * Supports vision/multimodal via optional images parameter.
 */
async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string | null,
  model: string,
  messages: any[],
  temperature: number,
  providerLabel: string,
  images?: string[]
): Promise<string> {
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  // Inject images into messages if present (OpenAI vision format)
  const finalMessages = images && images.length > 0
    ? injectImagesIntoMessages(messages, images)
    : messages;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, messages: finalMessages, temperature }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`${providerLabel} API Error: ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

export async function generateContent(
  prompt: string,
  apiKey: string,
  provider: AIProvider = 'deepseek',
  options: {
    temperature?: number;
    model?: string;
    messages?: any[];
    ollamaBaseUrl?: string;
    images?: string[];
  } = {}
) {
  const temperature = options.temperature ?? 0.7;
  const messages = options.messages || [{ role: 'user', content: prompt }];

  // --- OpenAI-compatible providers ---
  if (provider === 'deepseek' || provider === 'qwen' || provider === 'ollama') {
    const model = options.model || DEFAULT_MODELS[provider];
    let baseUrl: string;

    if (provider === 'ollama') {
      baseUrl = (options.ollamaBaseUrl || 'http://localhost:11434') + '/v1';
    } else {
      baseUrl = PROVIDER_URLS[provider];
    }

    return callOpenAICompatible(
      baseUrl,
      provider === 'ollama' ? null : apiKey,
      model,
      messages,
      temperature,
      provider.charAt(0).toUpperCase() + provider.slice(1),
      options.images
    );
  }

  // --- Gemini provider ---
    const modelName = options.model || 'gemini-1.5-flash';
    
    // Use @google/genai SDK for Gemini 3 and newer models
    const isGemini3OrNewer = modelName.includes('gemini-3') || modelName.includes('gemini-2.0');
    
    if (isGemini3OrNewer) {
      try {
        // Official Google implementation for Gemini 3
        // @ts-ignore
        const ai = new GoogleGenAI({ apiKey });
        
        // Handle messages format
        if (options.messages && options.messages.length > 0) {
          // Extract system message if present
          let processedMessages = [...options.messages];
          const systemMsg = processedMessages.find(m => m.role === 'system');
          let systemInstruction = undefined;
          
          if (systemMsg) {
            systemInstruction = systemMsg.content;
            processedMessages = processedMessages.filter(m => m.role !== 'system');
          }
          
          // Convert to Gemini 3 format: contents array with parts
          const contents = processedMessages.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
          }));
          
          // Build request following official Google pattern
          const requestBody: any = {
            model: modelName,
            contents: contents,
          };
          
          // Add system instruction if present
          if (systemInstruction) {
            requestBody.system_instruction = {
              parts: [{ text: systemInstruction }]
            };
          }
          
          // Add generation config
          if (temperature !== undefined) {
            requestBody.generation_config = { temperature };
          }
          
          const response = await ai.models.generateContent(requestBody);
          return response.text ?? '';
        } else {
          // Simple text prompt
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: temperature !== undefined ? { temperature } : undefined
          });
          return response.text ?? '';
        }
      } catch (error: any) {
        console.error(`Gemini 3 SDK error: ${error.message}. Falling back to REST API...`);
        // Fallback to REST API
        return generateContentViaRestAPI(modelName, prompt, apiKey, options, temperature);
      }
    } else {
      // Fallback to @google/generative-ai for older models like gemini-1.5
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: {
          temperature: temperature,
        }
      });
      
      // If messages are provided, use chat mode
      if (options.messages && options.messages.length > 0) {
        // Gemini doesn't support 'system' role in chat history
        // Prepend system message to first user message if present
        let processedMessages = [...options.messages];
        const systemMsg = processedMessages.find(m => m.role === 'system');
        
        if (systemMsg) {
          processedMessages = processedMessages.filter(m => m.role !== 'system');
          if (processedMessages[0]?.role === 'user') {
            processedMessages[0] = {
              ...processedMessages[0],
              content: `${systemMsg.content}\n\n${processedMessages[0].content}`
            };
          }
        }
        
        // Convert messages to Gemini format (exclude last message for history)
        const history = processedMessages.slice(0, -1).map(m => ({
          role: m.role === 'assistant' ? 'model' as const : 'user' as const,
          parts: [{ text: m.content }]
        }));
        
        const lastMessage = processedMessages[processedMessages.length - 1];
        
        const chat = model.startChat({ history });
        const result = await chat.sendMessage(lastMessage.content);
        return result.response.text();
      } else {
        // Simple generation
        const result = await model.generateContent(prompt);
        return result.response.text();
      }
    }

  // Should not reach here
  throw new Error(`Unsupported provider: ${provider}`);
}

/**
 * Fallback to Gemini 3 REST API when SDK fails
 */
async function generateContentViaRestAPI(
  modelName: string,
  prompt: string,
  apiKey: string,
  options: { temperature?: number, messages?: any[] },
  temperature: number
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
  
  // Build contents array following Google's official REST API format
  let contents: any[] = [];
  
  if (options.messages && options.messages.length > 0) {
    // Extract system message if present
    let processedMessages = [...options.messages];
    const systemMsg = processedMessages.find(m => m.role === 'system');
    
    // Convert messages to REST API format
    processedMessages.forEach(msg => {
      if (msg.role !== 'system') {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        });
      }
    });
    
    // For now, system message is prepended to first user message in REST API
    if (systemMsg && contents.length > 0 && contents[0].role === 'user') {
      contents[0].parts[0].text = `${systemMsg.content}\n\n${contents[0].parts[0].text}`;
    }
  } else {
    // Simple text prompt
    contents = [
      {
        parts: [{ text: prompt }]
      }
    ];
  }
  
  const payload: any = { contents };
  
  // Add generation config if temperature is set
  if (temperature !== undefined) {
    payload.generationConfig = { temperature };
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini 3 REST API Error: ${error}`);
  }
  
  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

