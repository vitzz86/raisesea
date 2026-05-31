'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const COUNTRIES = ['Singapore', 'Indonesia', 'Malaysia', 'Vietnam', 'Thailand', 'Philippines', 'Myanmar', 'Cambodia', 'Laos', 'Brunei', 'Timor-Leste']
const SECTORS = ['AI/ML', 'Fintech', 'SaaS', 'E-commerce', 'Healthtech', 'Logistics', 'Edtech', 'Agritech', 'Cleantech', 'Deep Tech', 'Consumer', 'Cybersecurity', 'Crypto/Web3']

type Props = {
  initialProfile: {
    full_name: string
    company_name: string
    country: string
    news_sectors: string[]
    email_digest_enabled: boolean
  }
  accountInfo: {
    email: string
    role: string
    plan: string
    memberSince: string
  }
}

export default function SettingsForm({ initialProfile, accountInfo }: Props) {
  const router = useRouter()
  const [profile, setProfile] = useState(initialProfile)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  function toggleSector(sector: string) {
    setProfile(p => ({
      ...p,
      news_sectors: p.news_sectors.includes(sector)
        ? p.news_sectors.filter(s => s !== sector)
        : [...p.news_sectors, sector],
    }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      setMessage({ kind: 'success', text: 'Profile saved.' })
      router.refresh()
    } catch (err) {
      setMessage({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Save failed',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Profile */}
      <form onSubmit={handleSave} className="bg-white border border-border rounded-xl p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-tertiary mb-4">Profile</h2>

        <div className="space-y-4">
          <Field label="Full name">
            <input
              type="text"
              value={profile.full_name}
              onChange={e => setProfile({ ...profile, full_name: e.target.value })}
              placeholder="Your name"
              className="input"
            />
          </Field>

          <Field label="Company name">
            <input
              type="text"
              value={profile.company_name}
              onChange={e => setProfile({ ...profile, company_name: e.target.value })}
              placeholder="Acme Inc."
              className="input"
            />
          </Field>

          <Field label="Country">
            <select
              value={profile.country}
              onChange={e => setProfile({ ...profile, country: e.target.value })}
              className="input"
            >
              <option value="">— select —</option>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-brand hover:bg-brand-hover text-white text-sm font-medium rounded-lg px-4 py-2 disabled:opacity-50 transition"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {message && (
            <span className={`text-sm ${message.kind === 'success' ? 'text-success-text' : 'text-danger-text'}`}>
              {message.text}
            </span>
          )}
        </div>
      </form>

      {/* News preferences */}
      <form onSubmit={handleSave} className="bg-white border border-border rounded-xl p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-tertiary mb-2">News preferences</h2>
        <p className="text-xs text-text-tertiary mb-4">
          Pick sectors to follow. Section 1 of the weekly digest is filtered by your picks.
        </p>
        <div className="flex flex-wrap gap-2">
          {SECTORS.map(sector => {
            const active = profile.news_sectors.includes(sector)
            return (
              <button
                key={sector}
                type="button"
                onClick={() => toggleSector(sector)}
                className={`text-xs px-3 py-1.5 rounded-full border transition ${
                  active
                    ? 'bg-brand text-white border-brand'
                    : 'bg-white text-text-secondary border-border-strong hover:border-text-tertiary'
                }`}
              >
                {sector}
              </button>
            )
          })}
        </div>

        {/* Email digest toggle */}
        <div className="mt-5 pt-5 border-t border-gray-100">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={profile.email_digest_enabled}
              onChange={e => setProfile({ ...profile, email_digest_enabled: e.target.checked })}
              className="mt-0.5"
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-text-primary">Send me the weekly digest</div>
              <div className="text-xs text-text-tertiary mt-0.5">Mondays at 9 AM SGT — Southeast Asia fundraising, tech, policy, and exits.</div>
            </div>
          </label>
        </div>

        <div className="mt-5">
          <button
            type="submit"
            disabled={saving}
            className="bg-brand hover:bg-brand-hover text-white text-sm font-medium rounded-lg px-4 py-2 disabled:opacity-50 transition"
          >
            {saving ? 'Saving…' : 'Save preferences'}
          </button>
        </div>
      </form>

      {/* Account info (read-only) */}
      <div className="bg-white border border-border rounded-xl p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-tertiary mb-4">Account</h2>
        <dl className="text-sm space-y-2">
          <Row label="Email" value={accountInfo.email} />
          <Row label="Role" value={cap(accountInfo.role)} />
          <Row label="Plan" value={cap(accountInfo.plan)} />
          <Row label="Member since" value={accountInfo.memberSince ? new Date(accountInfo.memberSince).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : '—'} />
        </dl>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          outline: none;
          transition: border-color 0.15s;
        }
        .input:focus {
          border-color: #1a4d2e;
          box-shadow: 0 0 0 3px rgba(26, 77, 46, 0.1);
        }
      `}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-secondary mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-gray-100 last:border-0">
      <dt className="text-text-tertiary">{label}</dt>
      <dd className="font-medium text-text-primary">{value}</dd>
    </div>
  )
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}
