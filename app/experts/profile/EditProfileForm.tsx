'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// Same grouped expertise structure as the apply form
const EXPERTISE_GROUPS: Array<{ label: string; items: string[] }> = [
  { label: 'Fundraising & Capital', items: ['Pre-seed fundraising','Seed fundraising','Early-stage fundraising (Pre-A / Series A)','Growth-stage fundraising (Series B+)','IPO readiness & prep','Pitch deck design','Investor outreach','Term sheet negotiation','Cap table modeling','M&A advisory'] },
  { label: 'Go-to-market & Growth', items: ['Go-to-market strategy','B2B sales','B2C growth','Product-market fit','Pricing strategy','International expansion','Strategic partnerships & BD'] },
  { label: 'SEA market knowledge', items: ['SEA market entry','Indonesia market','Singapore market','Vietnam market','Thailand market','Philippines market','Malaysia market'] },
  { label: 'Operations', items: ['Hiring & team building','Operations & supply chain','Legal & compliance','Tax & accounting','Brand & marketing','PR & communications'] },
  { label: 'Tech expertise', items: ['Engineering leadership','Product management','AI/ML implementation','Data infrastructure','Cloud & DevOps','Security & compliance','Mobile engineering','Web3 / blockchain engineering'] },
]
const ALL_EXPERTISE = EXPERTISE_GROUPS.flatMap(g => g.items)

type VcProfile = {
  id: string
  display_name: string
  fund_or_firm: string | null
  title: string | null
  bio: string | null
  what_i_offer: string | null
  linkedin_url: string | null
  website: string | null
  company_linkedin_url: string | null
  company_website: string | null
  hq_country: string | null
  hq_city: string | null
  years_experience: number | null
  languages: string[]
  expertise_areas: string[]
  investment_thesis: string | null
  ticket_min_usd: number | null
  ticket_max_usd: number | null
  invest_stages: string[]
  invest_sectors: string[]
  avatar_url: string | null
  is_listed: boolean
  profile_types: string[]
}

export default function EditProfileForm({ initialProfile }: { initialProfile: VcProfile }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [form, setForm] = useState({
    display_name:         initialProfile.display_name || '',
    fund_or_firm:         initialProfile.fund_or_firm || '',
    title:                initialProfile.title || '',
    bio:                  initialProfile.bio || '',
    what_i_offer:         initialProfile.what_i_offer || '',
    linkedin_url:         initialProfile.linkedin_url || '',
    website:              initialProfile.website || '',
    company_linkedin_url: initialProfile.company_linkedin_url || '',
    company_website:      initialProfile.company_website || '',
    hq_country:           initialProfile.hq_country || '',
    hq_city:              initialProfile.hq_city || '',
    years_experience:     initialProfile.years_experience != null ? String(initialProfile.years_experience) : '',
    languages:            initialProfile.languages || [],
    expertise_areas:      initialProfile.expertise_areas || [],
    investment_thesis:    initialProfile.investment_thesis || '',
    ticket_min_usd:       initialProfile.ticket_min_usd != null ? String(initialProfile.ticket_min_usd) : '',
    ticket_max_usd:       initialProfile.ticket_max_usd != null ? String(initialProfile.ticket_max_usd) : '',
    invest_stages:        initialProfile.invest_stages || [],
    invest_sectors:       initialProfile.invest_sectors || [],
    is_listed:            initialProfile.is_listed,
  })
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialProfile.avatar_url)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [customExpertise, setCustomExpertise] = useState('')

  const isInvestor = (initialProfile.profile_types || []).some(t => ['vc','cvc','angel'].includes(t))

  function toggleArr(field: keyof typeof form, value: string) {
    const cur = (form[field] as string[]) || []
    setForm({ ...form, [field]: cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value] })
  }

  function addCustom() {
    const v = customExpertise.trim()
    if (!v || form.expertise_areas.includes(v)) return
    setForm({ ...form, expertise_areas: [...form.expertise_areas, v] })
    setCustomExpertise('')
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    setMessage(null)
    try {
      const fd = new FormData()
      fd.append('avatar', file)
      const res = await fetch('/api/experts/avatar', { method: 'POST', body: fd })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.error || 'Upload failed')
      }
      const data = await res.json()
      setAvatarUrl(data.avatar_url)
      // Also persist on row immediately so it's saved even if user navigates away
      await fetch('/api/experts/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: data.avatar_url }),
      })
      router.refresh()
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Upload failed' })
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const payload = {
        ...form,
        years_experience: form.years_experience ? parseInt(form.years_experience, 10) : null,
        ticket_min_usd:   form.ticket_min_usd   ? parseInt(form.ticket_min_usd, 10)   : null,
        ticket_max_usd:   form.ticket_max_usd   ? parseInt(form.ticket_max_usd, 10)   : null,
      }
      const res = await fetch('/api/experts/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.error || `HTTP ${res.status}`)
      }
      setMessage({ kind: 'success', text: 'Profile saved.' })
      router.refresh()
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-3xl">
      {/* Quick links to expert-only pages */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link href="/experts/profile/availability"
          className="bg-white border border-border hover:border-[#1a4d2e] rounded-xl p-4 block transition">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Calendar &amp; availability</div>
          <div className="text-sm font-semibold text-gray-900">Set your weekly hours →</div>
        </Link>
        <Link href="/experts/meetings"
          className="bg-white border border-border hover:border-[#1a4d2e] rounded-xl p-4 block transition">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Meeting requests</div>
          <div className="text-sm font-semibold text-gray-900">Review incoming requests →</div>
        </Link>
      </div>

      {/* Avatar */}
      <Card title="Profile photo">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover border border-border" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-[#1a4d2e] text-white flex items-center justify-center text-2xl font-semibold">
              {(form.display_name[0] || 'E').toUpperCase()}
            </div>
          )}
          <label className="inline-block">
            <span className={`inline-block text-xs font-medium px-3 py-1.5 rounded-md cursor-pointer transition ${uploadingAvatar ? 'bg-gray-200 text-gray-500' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
              {uploadingAvatar ? 'Uploading…' : avatarUrl ? 'Change photo' : 'Upload photo'}
            </span>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} disabled={uploadingAvatar} className="hidden" />
          </label>
        </div>
      </Card>

      {/* Listing toggle */}
      <Card title="Directory visibility">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={form.is_listed}
            onChange={e => setForm({ ...form, is_listed: e.target.checked })}
            className="mt-0.5" />
          <div>
            <div className="text-sm font-medium text-gray-900">Show me in the public expert directory</div>
            <div className="text-xs text-gray-600">Uncheck to temporarily hide your profile from <Link href="/meet" className="text-[#1a4d2e] underline">/meet</Link> without deleting it.</div>
          </div>
        </label>
      </Card>

      {/* Identity */}
      <Card title="About you">
        <Grid>
          <Field label="Display name *"><input className="input" required value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} /></Field>
          <Field label="Title / role"><input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Partner, Founder, CTO" /></Field>
          <Field label="Fund / firm / company"><input className="input" value={form.fund_or_firm} onChange={e => setForm({ ...form, fund_or_firm: e.target.value })} /></Field>
          <Field label="Years of experience"><input className="input" type="number" min="0" max="60" value={form.years_experience} onChange={e => setForm({ ...form, years_experience: e.target.value })} /></Field>
          <Field label="Personal LinkedIn"><input className="input" type="url" value={form.linkedin_url} onChange={e => setForm({ ...form, linkedin_url: e.target.value })} /></Field>
          <Field label="Personal website"><input className="input" type="url" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} /></Field>
          <Field label="Company LinkedIn"><input className="input" type="url" value={form.company_linkedin_url} onChange={e => setForm({ ...form, company_linkedin_url: e.target.value })} /></Field>
          <Field label="Company website"><input className="input" type="url" value={form.company_website} onChange={e => setForm({ ...form, company_website: e.target.value })} /></Field>
          <Field label="Country"><input className="input" value={form.hq_country} onChange={e => setForm({ ...form, hq_country: e.target.value })} /></Field>
          <Field label="City"><input className="input" value={form.hq_city} onChange={e => setForm({ ...form, hq_city: e.target.value })} /></Field>
        </Grid>
      </Card>

      {/* Bio + what you offer */}
      <Card title="Tell founders about yourself">
        <Field label="Short bio"><textarea className="input" rows={3} value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} /></Field>
        <Field label="What you offer founders"><textarea className="input" rows={3} value={form.what_i_offer} onChange={e => setForm({ ...form, what_i_offer: e.target.value })} /></Field>
      </Card>

      {/* Expertise */}
      <Card title="Expertise areas">
        <div className="space-y-4">
          {EXPERTISE_GROUPS.map(group => (
            <div key={group.label}>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">{group.label}</div>
              <div className="flex flex-wrap gap-2">
                {group.items.map(area => {
                  const active = form.expertise_areas.includes(area)
                  return (
                    <button type="button" key={area} onClick={() => toggleArr('expertise_areas', area)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition ${active ? 'bg-[#1a4d2e] text-white border-[#1a4d2e]' : 'bg-white text-gray-700 border-border-strong hover:border-text-tertiary'}`}>
                      {area}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          {form.expertise_areas.filter(a => !ALL_EXPERTISE.includes(a)).length > 0 && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Custom</div>
              <div className="flex flex-wrap gap-2">
                {form.expertise_areas.filter(a => !ALL_EXPERTISE.includes(a)).map(area => (
                  <button type="button" key={area} onClick={() => toggleArr('expertise_areas', area)}
                    className="text-xs px-3 py-1.5 rounded-full bg-[#1a4d2e] text-white border border-[#1a4d2e]">{area} ×</button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <input type="text" value={customExpertise} placeholder="Add custom expertise"
              onChange={e => setCustomExpertise(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
              className="input flex-1" />
            <button type="button" onClick={addCustom} className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded-md whitespace-nowrap">+ Add</button>
          </div>
        </div>
      </Card>

      {/* Investor fields */}
      {isInvestor && (
        <Card title="Investment profile">
          <Field label="Investment thesis"><textarea className="input" rows={2} value={form.investment_thesis} onChange={e => setForm({ ...form, investment_thesis: e.target.value })} /></Field>
          <Grid>
            <Field label="Min ticket (USD)"><input className="input" type="number" min="0" value={form.ticket_min_usd} onChange={e => setForm({ ...form, ticket_min_usd: e.target.value })} /></Field>
            <Field label="Max ticket (USD)"><input className="input" type="number" min="0" value={form.ticket_max_usd} onChange={e => setForm({ ...form, ticket_max_usd: e.target.value })} /></Field>
          </Grid>
        </Card>
      )}

      {message && (
        <div className={`rounded-lg p-3 text-sm ${message.kind === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving}
          className="bg-[#1a4d2e] hover:bg-[#143d24] text-white text-sm font-medium rounded-lg px-6 py-2.5 disabled:opacity-50 transition">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <Link href="/meet" className="text-xs text-gray-600 hover:text-gray-900 underline">View directory</Link>
      </div>

      <style jsx>{`
        .input { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #8a9d8f; border-radius: 0.5rem; font-size: 0.875rem; outline: none; transition: border-color 0.15s, box-shadow 0.15s; background: white; }
        .input:focus { border-color: #1a4d2e; box-shadow: 0 0 0 3px rgba(26, 77, 46, 0.15); }
      `}</style>
    </form>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-border rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-gray-700 mb-1.5">{label}</label>{children}</div>
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
}
