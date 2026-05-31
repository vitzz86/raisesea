'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const PROFILE_TYPES = [
  { value: 'vc',            label: 'Venture Capital',         desc: 'Independent fund partner or principal' },
  { value: 'cvc',           label: 'Corporate Venture (CVC)', desc: 'Investing on behalf of a corporate parent' },
  { value: 'corporate',     label: 'Corporate',               desc: 'Strategy, BD, or partnerships at a SEA company' },
  { value: 'angel',         label: 'Angel',                   desc: 'Investing personal capital in startups' },
  { value: 'advisor',       label: 'Advisor',                 desc: 'Strategic guidance, board observer, fractional roles' },
  { value: 'domain_expert', label: 'Domain Expert',           desc: 'Specialist in legal, marketing, tech, sales, etc.' },
]

const COUNTRIES = ['Singapore','Indonesia','Malaysia','Vietnam','Thailand','Philippines','Myanmar','Cambodia','Laos','Brunei','Timor-Leste','Other']

const STAGES = ['Pre-seed','Seed','Pre-Series A','Series A','Series B','Series C+','Growth']
const SECTORS = ['AI/ML','Fintech','SaaS','E-commerce','Healthtech','Logistics','Edtech','Agritech','Cleantech','Deep Tech','Consumer','Cybersecurity','Crypto/Web3','Other']
// Grouped expertise areas — sections are visual only, all chips
// flatten into a single `expertise_areas[]` array on the backend.
const EXPERTISE_GROUPS: Array<{ label: string; items: string[] }> = [
  {
    label: 'Fundraising & Capital',
    items: [
      'Pre-seed fundraising', 'Seed fundraising',
      'Early-stage fundraising (Pre-A / Series A)',
      'Growth-stage fundraising (Series B+)',
      'IPO readiness & prep',
      'Pitch deck design', 'Investor outreach',
      'Term sheet negotiation', 'Cap table modeling', 'M&A advisory',
    ],
  },
  {
    label: 'Go-to-market & Growth',
    items: [
      'Go-to-market strategy', 'B2B sales', 'B2C growth',
      'Product-market fit', 'Pricing strategy',
      'International expansion', 'Strategic partnerships & BD',
    ],
  },
  {
    label: 'SEA market knowledge',
    items: [
      'SEA market entry', 'Indonesia market', 'Singapore market',
      'Vietnam market', 'Thailand market', 'Philippines market', 'Malaysia market',
    ],
  },
  {
    label: 'Operations',
    items: [
      'Hiring & team building', 'Operations & supply chain',
      'Legal & compliance', 'Tax & accounting',
      'Brand & marketing', 'PR & communications',
    ],
  },
  {
    label: 'Tech expertise',
    items: [
      'Engineering leadership', 'Product management',
      'AI/ML implementation', 'Data infrastructure',
      'Cloud & DevOps', 'Security & compliance',
      'Mobile engineering', 'Web3 / blockchain engineering',
    ],
  },
]
const ALL_EXPERTISE = EXPERTISE_GROUPS.flatMap(g => g.items)
const LANGUAGES = ['English','Bahasa Indonesia','Mandarin','Bahasa Melayu','Vietnamese','Thai','Tagalog','Japanese','Korean']

type Props = {
  prefill: {
    display_name: string
    fund_or_firm: string
    hq_country: string
    avatar_url?: string | null
  }
}

export default function ExpertApplyForm({ prefill }: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    profile_types:        [] as string[],
    display_name:         prefill.display_name,
    fund_or_firm:         prefill.fund_or_firm,
    title:                '',
    bio:                  '',
    what_i_offer:         '',
    linkedin_url:         '',
    website:              '',
    company_website:      '',
    company_linkedin_url: '',
    hq_country:           prefill.hq_country || 'Singapore',
    hq_city:              '',
    years_experience:     '',
    languages:            ['English'],
    invest_stages:        [] as string[],
    invest_sectors:       [] as string[],
    expertise_areas:      [] as string[],
    ticket_min_usd:       '',
    ticket_max_usd:       '',
    investment_thesis:    '',
  })
  const [customExpertise, setCustomExpertise] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(prefill.avatar_url || null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarError(null)
    if (file.size > 5 * 1024 * 1024) { setAvatarError('Photo must be under 5MB'); return }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setAvatarError('Photo must be JPEG, PNG, or WebP')
      return
    }
    setUploadingAvatar(true)
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
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadingAvatar(false)
    }
  }

  function getInitial(): string {
    return (form.display_name[0] || 'E').toUpperCase()
  }

  function toggleArrayField(field: keyof typeof form, value: string) {
    const current = form[field] as string[]
    setForm({
      ...form,
      [field]: current.includes(value) ? current.filter(v => v !== value) : [...current, value],
    })
  }

  function addCustomExpertise() {
    const v = customExpertise.trim()
    if (!v || form.expertise_areas.includes(v)) return
    setForm({ ...form, expertise_areas: [...form.expertise_areas, v] })
    setCustomExpertise('')
  }

  const isInvestor = form.profile_types.some(t => ['vc','cvc','angel'].includes(t))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Validation
    if (form.profile_types.length === 0)   { setError('Pick at least one profile type'); return }
    if (!form.display_name.trim())          { setError('Display name is required'); return }
    if (!form.bio.trim() || form.bio.length < 50) { setError('Bio must be at least 50 characters'); return }
    if (!form.what_i_offer.trim() || form.what_i_offer.length < 30) { setError('Tell us what you offer founders (at least 30 chars)'); return }
    if (form.expertise_areas.length === 0) { setError('Pick at least one expertise area'); return }
    if (!form.linkedin_url.trim())          { setError('LinkedIn URL is required (for verification)'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/experts/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          avatar_url:       avatarUrl,  // pass the URL we got from the upload step
          years_experience: form.years_experience ? parseInt(form.years_experience, 10) : null,
          ticket_min_usd:   form.ticket_min_usd   ? parseInt(form.ticket_min_usd, 10)   : null,
          ticket_max_usd:   form.ticket_max_usd   ? parseInt(form.ticket_max_usd, 10)   : null,
        }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.error || `HTTP ${res.status}`)
      }
      router.push('/experts/apply')  // reloads page → shows pending status card
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {/* Profile type */}
      <Card title="What describes you?" subtitle="Pick all that apply — many people wear multiple hats">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PROFILE_TYPES.map(t => {
            const active = form.profile_types.includes(t.value)
            return (
              <button
                type="button"
                key={t.value}
                onClick={() => toggleArrayField('profile_types', t.value)}
                className={`text-left p-3 rounded-lg border-2 transition ${
                  active ? 'border-[#1a4d2e] bg-[#1a4d2e]/5' : 'border-border hover:border-border-strong'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                    active ? 'border-[#1a4d2e] bg-[#1a4d2e]' : 'border-border-strong'
                  }`}>
                    {active && <span className="text-white text-[10px]">✓</span>}
                  </div>
                  <span className="text-sm font-medium text-gray-900">{t.label}</span>
                </div>
                <p className="text-xs text-gray-600 mt-1 ml-6">{t.desc}</p>
              </button>
            )
          })}
        </div>
      </Card>

      {/* Profile photo (optional — default is initial letter) */}
      <Card title="Profile photo (optional)" subtitle="JPEG, PNG, or WebP. Max 5MB. Leave blank to use your initial in a green circle.">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="Your avatar" className="w-16 h-16 rounded-full object-cover border border-border" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-[#1a4d2e] text-white flex items-center justify-center text-2xl font-semibold">
              {getInitial()}
            </div>
          )}
          <div className="flex-1">
            <label className="inline-block">
              <span className={`inline-block text-xs font-medium px-3 py-1.5 rounded-md cursor-pointer transition ${
                uploadingAvatar ? 'bg-gray-200 text-gray-500' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}>
                {uploadingAvatar ? 'Uploading…' : avatarUrl ? 'Change photo' : 'Upload photo'}
              </span>
              <input type="file" accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarChange} disabled={uploadingAvatar}
                className="hidden" />
            </label>
            {avatarError && <div className="text-xs text-red-600 mt-1">{avatarError}</div>}
          </div>
        </div>
      </Card>

      {/* Identity */}
      <Card title="About you">
        <Grid>
          <Field label="Display name *">
            <input type="text" value={form.display_name}
              onChange={e => setForm({ ...form, display_name: e.target.value })}
              className="input" required />
          </Field>
          <Field label="Title / role">
            <input type="text" value={form.title} placeholder="e.g. Partner, Founder, CTO"
              onChange={e => setForm({ ...form, title: e.target.value })}
              className="input" />
          </Field>
          <Field label="Fund / firm / company">
            <input type="text" value={form.fund_or_firm}
              onChange={e => setForm({ ...form, fund_or_firm: e.target.value })}
              className="input" />
          </Field>
          <Field label="Years of experience">
            <input type="number" min="0" max="60" value={form.years_experience}
              onChange={e => setForm({ ...form, years_experience: e.target.value })}
              className="input" />
          </Field>
          <Field label="Personal LinkedIn *">
            <input type="url" value={form.linkedin_url}
              placeholder="https://linkedin.com/in/..."
              onChange={e => setForm({ ...form, linkedin_url: e.target.value })}
              className="input" required />
          </Field>
          <Field label="Personal website (optional)">
            <input type="url" value={form.website}
              placeholder="https://yourblog.com"
              onChange={e => setForm({ ...form, website: e.target.value })}
              className="input" />
          </Field>
          <Field label="Company LinkedIn (optional)">
            <input type="url" value={form.company_linkedin_url}
              placeholder="https://linkedin.com/company/..."
              onChange={e => setForm({ ...form, company_linkedin_url: e.target.value })}
              className="input" />
          </Field>
          <Field label="Company website (optional)">
            <input type="url" value={form.company_website}
              placeholder="https://wavemaker.vc"
              onChange={e => setForm({ ...form, company_website: e.target.value })}
              className="input" />
          </Field>
          <Field label="Country">
            <select value={form.hq_country}
              onChange={e => setForm({ ...form, hq_country: e.target.value })}
              className="input">
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="City">
            <input type="text" value={form.hq_city}
              onChange={e => setForm({ ...form, hq_city: e.target.value })}
              className="input" />
          </Field>
        </Grid>
      </Card>

      {/* Bio + what you offer */}
      <Card title="Tell founders about yourself">
        <Field label="Short bio * (50+ chars)">
          <textarea value={form.bio} rows={3}
            placeholder="Your background, what you've done, why you care about SEA founders."
            onChange={e => setForm({ ...form, bio: e.target.value })}
            className="input" />
          <div className="text-xs text-gray-500 mt-1">{form.bio.length} characters</div>
        </Field>
        <Field label="What you offer founders * (30+ chars)">
          <textarea value={form.what_i_offer} rows={3}
            placeholder="e.g. I help Pre-A SaaS founders close their first $1M ARR. Specifically, I do 1:1 mentoring on pricing strategy, hiring early sales reps, and cold outreach playbooks."
            onChange={e => setForm({ ...form, what_i_offer: e.target.value })}
            className="input" />
          <div className="text-xs text-gray-500 mt-1">{form.what_i_offer.length} characters</div>
        </Field>
      </Card>

      {/* Expertise areas — visually grouped, stored as flat array */}
      <Card title="Expertise areas *" subtitle="Pick the things you can help founders with. Add custom areas at the bottom.">
        <div className="space-y-4">
          {EXPERTISE_GROUPS.map(group => (
            <div key={group.label}>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
                {group.label}
              </div>
              <div className="flex flex-wrap gap-2">
                {group.items.map(area => {
                  const active = form.expertise_areas.includes(area)
                  return (
                    <button
                      type="button"
                      key={area}
                      onClick={() => toggleArrayField('expertise_areas', area)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition ${
                        active ? 'bg-[#1a4d2e] text-white border-[#1a4d2e]' : 'bg-white text-gray-700 border-border-strong hover:border-text-tertiary'
                      }`}
                    >
                      {area}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          {/* Custom additions */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
              Other
            </div>
            {/* Show custom chips (anything not in ALL_EXPERTISE) */}
            {form.expertise_areas.filter(a => !ALL_EXPERTISE.includes(a)).length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {form.expertise_areas.filter(a => !ALL_EXPERTISE.includes(a)).map(area => (
                  <button
                    type="button"
                    key={area}
                    onClick={() => toggleArrayField('expertise_areas', area)}
                    className="text-xs px-3 py-1.5 rounded-full bg-[#1a4d2e] text-white border border-[#1a4d2e] inline-flex items-center gap-1.5"
                  >
                    {area} <span className="text-xs opacity-70">×</span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input type="text" value={customExpertise}
                placeholder="Add custom expertise area"
                onChange={e => setCustomExpertise(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomExpertise() } }}
                className="input flex-1" />
              <button type="button" onClick={addCustomExpertise}
                className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded-md whitespace-nowrap">+ Add</button>
            </div>
          </div>
        </div>
        {form.expertise_areas.length > 0 && (
          <div className="mt-3 text-xs text-gray-600 pt-3 border-t border-gray-100">
            <strong>{form.expertise_areas.length} selected</strong>
          </div>
        )}
      </Card>

      {/* Languages */}
      <Card title="Languages you speak">
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map(lang => {
            const active = form.languages.includes(lang)
            return (
              <button
                type="button"
                key={lang}
                onClick={() => toggleArrayField('languages', lang)}
                className={`text-xs px-3 py-1.5 rounded-full border transition ${
                  active ? 'bg-[#1a4d2e] text-white border-[#1a4d2e]' : 'bg-white text-gray-700 border-border-strong hover:border-text-tertiary'
                }`}
              >
                {lang}
              </button>
            )
          })}
        </div>
      </Card>

      {/* Investor-only fields */}
      {isInvestor && (
        <Card title="Investment profile" subtitle="Helps us match the right founders to you">
          <Field label="Stages you invest in">
            <div className="flex flex-wrap gap-2">
              {STAGES.map(s => {
                const active = form.invest_stages.includes(s)
                return (
                  <button type="button" key={s} onClick={() => toggleArrayField('invest_stages', s)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition ${
                      active ? 'bg-[#1a4d2e] text-white border-[#1a4d2e]' : 'bg-white text-gray-700 border-border-strong hover:border-text-tertiary'
                    }`}>{s}</button>
                )
              })}
            </div>
          </Field>
          <Field label="Sectors of interest">
            <div className="flex flex-wrap gap-2">
              {SECTORS.map(s => {
                const active = form.invest_sectors.includes(s)
                return (
                  <button type="button" key={s} onClick={() => toggleArrayField('invest_sectors', s)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition ${
                      active ? 'bg-[#1a4d2e] text-white border-[#1a4d2e]' : 'bg-white text-gray-700 border-border-strong hover:border-text-tertiary'
                    }`}>{s}</button>
                )
              })}
            </div>
          </Field>
          <Grid>
            <Field label="Min ticket size (USD)">
              <input type="number" min="0" step="10000" placeholder="50000" value={form.ticket_min_usd}
                onChange={e => setForm({ ...form, ticket_min_usd: e.target.value })} className="input" />
            </Field>
            <Field label="Max ticket size (USD)">
              <input type="number" min="0" step="10000" placeholder="500000" value={form.ticket_max_usd}
                onChange={e => setForm({ ...form, ticket_max_usd: e.target.value })} className="input" />
            </Field>
          </Grid>
          <Field label="Investment thesis">
            <textarea value={form.investment_thesis} rows={2}
              placeholder="One-paragraph thesis: what you back, why."
              onChange={e => setForm({ ...form, investment_thesis: e.target.value })} className="input" />
          </Field>
        </Card>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={submitting}
          className="bg-[#1a4d2e] hover:bg-[#143d24] text-white text-sm font-medium rounded-lg px-6 py-2.5 disabled:opacity-50 transition">
          {submitting ? 'Submitting…' : 'Submit application'}
        </button>
        <span className="text-xs text-gray-500">Reviewed within 5 business days</span>
      </div>

      <style jsx>{`
        .input { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #8a9d8f; border-radius: 0.5rem; font-size: 0.875rem; outline: none; transition: border-color 0.15s, box-shadow 0.15s; background: white; }
        .input:focus { border-color: #1a4d2e; box-shadow: 0 0 0 3px rgba(26, 77, 46, 0.15); }
      `}</style>
    </form>
  )
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-border rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5 mb-3">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
}
