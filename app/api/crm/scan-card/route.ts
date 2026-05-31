import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase-server'

export const maxDuration = 30
export const runtime = 'nodejs'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro'] as const

// Strict prompt — Gemini returns JSON only; we never trust shape, we parse defensively.
const PROMPT = `You are extracting contact information from a business card image. Look at the image and return STRICT JSON in this exact shape, with no markdown fences, no preamble, no commentary:

{
  "name": "Full name as it appears, or empty string",
  "title": "Job title / role, or empty string",
  "company": "Company / organization name, or empty string",
  "email": "Email address, or empty string",
  "phone": "Phone number including country code if visible, or empty string",
  "linkedin_url": "LinkedIn URL or handle (no plain @), or empty string"
}

Rules:
- If a field is not visible or unreadable, return an empty string for it (never null, never omit the key).
- For phone numbers, preserve the format on the card (with spaces, dashes, country code).
- For linkedin_url, if you see a handle like "linkedin.com/in/janedoe" return the full URL "https://linkedin.com/in/janedoe".
- Never invent or guess details. If unsure, leave empty.
- Return ONLY the JSON object.`

type Extracted = { name: string; title: string; company: string; email: string; phone: string; linkedin_url: string }

async function callGeminiVision(base64Image: string, mimeType: string): Promise<Extracted | null> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured')
  let lastErr: unknown = null

  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: PROMPT },
                { inline_data: { mime_type: mimeType, data: base64Image } },
              ],
            }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 1024,
              responseMimeType: 'application/json',
            },
          }),
          signal: AbortSignal.timeout(30_000),
        })
        if (!res.ok) {
          const txt = await res.text()
          const msg = `Gemini ${res.status} (${model}): ${txt.slice(0, 150)}`
          if ((res.status >= 500 || res.status === 429) && attempt < 3) {
            await new Promise(r => setTimeout(r, 1500 * Math.pow(2, attempt - 1)))
            lastErr = new Error(msg); continue
          }
          throw new Error(msg)
        }
        const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        if (!text) { lastErr = new Error('Empty response'); continue }
        try {
          const parsed = JSON.parse(text) as Partial<Extracted>
          return {
            name:          String(parsed.name || '').trim().slice(0, 120),
            title:         String(parsed.title || '').trim().slice(0, 120),
            company:       String(parsed.company || '').trim().slice(0, 120),
            email:         String(parsed.email || '').trim().slice(0, 200),
            phone:         String(parsed.phone || '').trim().slice(0, 60),
            linkedin_url:  String(parsed.linkedin_url || '').trim().slice(0, 300),
          }
        } catch {
          console.warn('[scan-card] parse failed, raw:', text.slice(0, 200))
          lastErr = new Error('JSON parse failed')
          if (attempt < 3) continue
        }
      } catch (err) {
        lastErr = err
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 1500 * Math.pow(2, attempt - 1)))
          continue
        }
      }
    }
    // model exhausted — fall through to next model
    console.warn(`[scan-card] ${model} exhausted, falling through`)
  }
  throw lastErr instanceof Error ? lastErr : new Error('Gemini scan failed')
}

// POST /api/crm/scan-card — body: { imageBase64: string, mimeType: string }
// Image is processed in-memory and discarded. Never written to disk or DB.
export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { imageBase64?: string; mimeType?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const imageBase64 = (body.imageBase64 || '').replace(/^data:image\/[a-z]+;base64,/, '')
  const mimeType = body.mimeType || 'image/jpeg'
  if (!imageBase64 || imageBase64.length < 100) {
    return NextResponse.json({ error: 'Image required' }, { status: 400 })
  }
  // Hard cap ~7MB base64 = ~5MB raw image
  if (imageBase64.length > 7_500_000) {
    return NextResponse.json({ error: 'Image too large (max ~5MB)' }, { status: 413 })
  }
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic'].includes(mimeType)) {
    return NextResponse.json({ error: 'Unsupported image format' }, { status: 415 })
  }

  try {
    const extracted = await callGeminiVision(imageBase64, mimeType)
    if (!extracted) return NextResponse.json({ error: 'Extraction returned empty' }, { status: 500 })
    return NextResponse.json({ ok: true, extracted })
  } catch (err) {
    console.error('[scan-card] failed:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Scan failed' }, { status: 500 })
  }
}
