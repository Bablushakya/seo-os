export const dynamic = 'force-dynamic'

import { withErrorHandler, formatResponse } from '@/lib/api-handler'
import { requireAuth } from '@/lib/auth/rbac'
import { generateText } from '@/lib/ai/gemini'
import { Errors } from '@/lib/errors'

/**
 * POST /api/ai/topic-ideas
 * 
 * Generates 5 unique, search-optimized guest post topic ideas in JSON format.
 * Accessible to all authenticated users.
 */
export const POST = withErrorHandler(async (req: Request) => {
  await requireAuth()

  const bodyData = await req.json()
  const niche = bodyData.niche
  const targetSite = bodyData.target_site || bodyData.targetSite
  const existingTopics = bodyData.existing_topics || bodyData.existingTopics || []

  if (!niche || !targetSite) {
    throw Errors.validation('niche and target_site are required fields.')
  }

  const prompt = `
Generate exactly 5 unique, creative, and search-optimized guest post topic ideas for a website.
Details:
- Website Niche: ${niche}
- Target Website: ${targetSite}
${existingTopics.length > 0 ? `- Existing Topics already covered (do NOT duplicate these): ${existingTopics.join(', ')}` : ''}

Instructions:
- Return exactly 5 ideas in JSON format.
- Output MUST be a raw JSON array matching this schema:
  [
    {
      "title": "Topic Title",
      "angle": "What makes this angle unique, who is the audience, and what value does it bring?",
      "target_keyword": "primary target keyword",
      "suggestedWordCount": 1000
    }
  ]
- Do NOT wrap the JSON in markdown code blocks (like \`\`\`json ... \`\`\`). Return ONLY the raw JSON string.
- Ideas should be highly relevant to the niche, engaging, and search-optimized.
`

  const cacheKey = `topic-ideas-${niche}-${targetSite}-${existingTopics.join('-')}`
  const generatedText = await generateText(prompt, cacheKey)

  // Clean markdown code blocks if present
  let cleanText = generatedText.trim()
  if (cleanText.startsWith('```')) {
    cleanText = cleanText.replace(/^```(json)?\s*/i, '').replace(/```\s*$/, '').trim()
  }

  try {
    const parsed = JSON.parse(cleanText)
    if (!Array.isArray(parsed)) {
      throw new Error('Response is not a JSON array')
    }
    return formatResponse(parsed)
  } catch (parseError) {
    console.error('Failed to parse JSON from Gemini:', cleanText, parseError)
    
    // In case of parse failure, return a fallback array of topics
    const fallback = [
      {
        title: `10 Essential Tips for success in ${niche}`,
        angle: `A detailed guide covering the top 10 things every beginner needs to know about ${niche}.`,
        target_keyword: `${niche} tips`,
        suggestedWordCount: 1200,
      },
      {
        title: `The Future of ${niche}: What to expect in the next 5 years`,
        angle: `An analytical forecast of trends, innovations, and shifts shaping ${niche}.`,
        target_keyword: `${niche} trends`,
        suggestedWordCount: 1500,
      },
      {
        title: `Common Mistakes to Avoid in ${niche}`,
        angle: `A compilation of the biggest pitfalls practitioners face in ${niche} and how to bypass them.`,
        target_keyword: `${niche} mistakes`,
        suggestedWordCount: 1000,
      },
      {
        title: `How to choose the best tools for ${niche}`,
        angle: `A comparison review of top industry platforms, apps, and tools used for ${niche} projects.`,
        target_keyword: `${niche} tools`,
        suggestedWordCount: 1200,
      },
      {
        title: `A Case Study: Scaling outreach in ${niche}`,
        angle: `A data-backed review showing step-by-step how a brand grew its presence in ${niche} niches.`,
        target_keyword: `${niche} case study`,
        suggestedWordCount: 1800,
      }
    ]
    return formatResponse(fallback)
  }
})
