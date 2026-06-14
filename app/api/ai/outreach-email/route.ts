export const dynamic = 'force-dynamic'

import { withErrorHandler, formatResponse } from '@/lib/api-handler'
import { requireAuth } from '@/lib/auth/rbac'
import { generateText } from '@/lib/ai/gemini'
import { Errors } from '@/lib/errors'

/**
 * POST /api/ai/outreach-email
 * 
 * Generates a blogger outreach email pitch based on tone, niche, and site.
 * Accessible to all authenticated users.
 */
export const POST = withErrorHandler(async (req: Request) => {
  await requireAuth()

  const bodyData = await req.json()
  const siteName = bodyData.site_name || bodyData.siteName
  const niche = bodyData.niche
  const contactName = bodyData.contact_name || bodyData.contactName
  const proposedTopic = bodyData.proposed_topic || bodyData.proposedTopic
  const tone = bodyData.tone || 'professional'

  if (!siteName || !niche || !contactName) {
    throw Errors.validation('site_name, niche, and contact_name are required fields.')
  }

  const prompt = `
Write a highly personalized outreach email for guest posting.
Details:
- Target Site Name: ${siteName}
- Niche: ${niche}
- Contact Person: ${contactName}
${proposedTopic ? `- Proposed Topic Idea: ${proposedTopic}` : ''}
- Tone: ${tone}

Instructions:
- The email must be brief, engaging, and under 150 words.
- Personalize it using the target site's name and niche.
- Propose writing a high-quality guest post for them.
- Suggest 2 short, interesting topic ideas (if a proposed topic idea is specified above, use that as one of the ideas, and invent one more relevant idea. If no proposed topic idea is specified, invent 2 relevant ideas).
- Use a clear subject line at the very top (format: "Subject: [Your Subject Line]").
- End with a call to action asking if they are open to pitches.
- Do NOT include any placeholder brackets (e.g. "[My Name]" or "[My Brand]"), use generic names or leave space for the user to sign off.
`

  const cacheKey = `outreach-email-${siteName}-${niche}-${contactName}-${proposedTopic || 'none'}-${tone}`
  const generatedText = await generateText(prompt, cacheKey)

  // Parse subject and body from the generated text
  let subject = 'Guest Post Pitch'
  let body = generatedText

  if (generatedText.includes('Subject:')) {
    const lines = generatedText.split('\n')
    const subjectLine = lines.find((l) => l.startsWith('Subject:'))
    if (subjectLine) {
      subject = subjectLine.replace('Subject:', '').trim()
      body = lines
        .filter((l) => !l.startsWith('Subject:'))
        .join('\n')
        .trim()
    }
  }

  return formatResponse({
    subject,
    body,
    text: generatedText,
  })
})
