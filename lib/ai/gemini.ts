import { GoogleGenerativeAI } from '@google/generative-ai'

// In-memory cache Map
interface CacheEntry {
  result: string
  expiresAt: number
}

const aiCache = new Map<string, CacheEntry>()

// Rate Limiter to stay within the free tier limits (max 12 requests per minute)
class RateLimiter {
  private queue: (() => void)[] = []
  private lastRequestTime = 0
  private minDelayMs = 5000 // 5 seconds gap (12 requests/min)
  private processing = false

  async throttle(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.queue.push(resolve)
      this.processQueue()
    })
  }

  private async processQueue() {
    if (this.processing) return
    this.processing = true

    while (this.queue.length > 0) {
      const now = Date.now()
      const timeSinceLast = now - this.lastRequestTime
      const delay = Math.max(0, this.minDelayMs - timeSinceLast)

      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay))
      }

      const resolve = this.queue.shift()
      if (resolve) {
        this.lastRequestTime = Date.now()
        resolve()
      }
    }

    this.processing = false
  }
}

const aiLimiter = new RateLimiter()

/**
 * Calls Gemini 1.5 Flash to generate text from a prompt.
 * Uses in-memory cache and falls back to OpenRouter if Gemini fails or rate limits.
 */
export async function generateText(prompt: string, cacheKey?: string): Promise<string> {
  const key = cacheKey || prompt
  
  // Check Cache
  const cached = aiCache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result
  }

  // Throttle request
  await aiLimiter.throttle()

  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set')
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    
    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()

    if (text) {
      // Store in cache for 24 hours
      aiCache.set(key, {
        result: text,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      })
      return text
    }
    
    throw new Error('Empty response from Gemini API')
  } catch (error) {
    console.error('Gemini API call failed, attempting OpenRouter fallback:', error)
    
    // Attempt OpenRouter fallback
    const openRouterKey = process.env.OPENROUTER_API_KEY
    if (openRouterKey) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openRouterKey}`,
            'HTTP-Referer': 'https://seo-os.local',
            'X-Title': 'SEO-OS',
          },
          body: JSON.stringify({
            model: 'mistralai/mistral-7b-instruct:free',
            messages: [{ role: 'user', content: prompt }],
          }),
        })

        if (response.ok) {
          const data = await response.json()
          const text = data.choices?.[0]?.message?.content?.trim()
          
          if (text) {
            aiCache.set(key, {
              result: text,
              expiresAt: Date.now() + 24 * 60 * 60 * 1000,
            })
            return text
          }
        } else {
          console.error(`OpenRouter error status: ${response.status}`)
        }
      } catch (orError) {
        console.error('OpenRouter fallback failed:', orError)
      }
    }
    
    // Catch-all fallback if everything fails
    return 'Summary unavailable'
  }
}
