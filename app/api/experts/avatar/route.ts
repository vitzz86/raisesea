// ═══════════════════════════════════════════════════════════════
// POST /api/experts/avatar — upload profile photo
// Accepts multipart/form-data with 'avatar' file (max 5MB, image only).
// Stores at expert-avatars/<user_id>.<ext>, returns public URL.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 4 * 1024 * 1024  // 4MB — kept just under Vercel's 4.5MB function body limit
const BUCKET = 'expert-avatars'

export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let file: File | null
  try {
    const formData = await req.formData()
    file = formData.get('avatar') as File | null
  } catch {
    return NextResponse.json({ error: 'Invalid multipart upload' }, { status: 400 })
  }

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.size === 0) return NextResponse.json({ error: 'Empty file' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File exceeds 4MB' }, { status: 400 })
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: 'File must be JPEG, PNG, or WebP' }, { status: 400 })
  }

  // Derive extension from MIME (safer than trusting filename)
  const ext = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp'
  const path = `${user.id}.${ext}`

  // Upload (upsert = overwrites if already exists, replacing the old avatar)
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
      cacheControl: '60',  // short cache so avatar updates appear quickly
    })
  if (uploadErr) {
    console.error('[avatar upload] failed:', uploadErr.message)
    return NextResponse.json({ error: uploadErr.message }, { status: 500 })
  }

  // Public URL (bucket is public)
  const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
  // Append a cache-buster so the browser fetches the new image immediately
  const avatarUrl = `${pub.publicUrl}?t=${Date.now()}`

  // Save URL on the vc_profile row if one exists for this user
  await supabaseAdmin
    .from('vc_profiles')
    .update({ avatar_url: avatarUrl })
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true, avatar_url: avatarUrl })
}
