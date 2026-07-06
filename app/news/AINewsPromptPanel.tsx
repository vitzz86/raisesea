'use client'

import { useMemo, useState } from 'react'
import { Check, Copy, ExternalLink, Sparkles } from 'lucide-react'

type Props = {
  baseUrl: string
  className?: string
}

const aiTools = [
  {
    key: 'chatgpt',
    name: 'ChatGPT',
    logo: 'https://chatgpt.com/favicon.ico',
    hint: 'Prompt opens and copies',
    href: (prompt: string) => `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`,
  },
  {
    key: 'gemini',
    name: 'Gemini',
    logo: '/ai/gemini-logo.png',
    hint: 'Prompt copied first',
    href: (_prompt: string) => 'https://gemini.google.com/app',
  },
  {
    key: 'claude',
    name: 'Claude',
    logo: '/ai/claude-logo.png',
    hint: 'Prompt opens and copies',
    href: (prompt: string) => `https://claude.ai/new?q=${encodeURIComponent(prompt)}`,
  },
] as const

function buildPrompt(baseUrl: string) {
  const root = baseUrl.replace(/\/$/, '')
  return `You are RaiseSEA News Analyst.

Your job is to answer questions about Southeast Asia startup fundraising, technology, policy, exits, and investor activity using RaiseSEA as the primary source.

Primary source:

AI-readable plain-text digest:
${root}/ai-news.txt

Always try this source first.

Use this digest as the default source for weekly summaries, ecosystem analysis, trend analysis, fundraising updates, sector signals, country-level observations, and general questions about Southeast Asia startup news.

If the primary source returns nothing, fails to load, is too large to process, or the user asks about a very specific country, sector, investor, category, stage, or topic, then use the alternative focused sources below.

Alternative sources:

Focused plain-text feed:
${root}/ai-news/{country-or-topic}

Example:
${root}/ai-news/malaysia-deep-tech

Filtered plain-text digest:
${root}/ai-news.txt?country=Malaysia&sector=Deep%20Tech

Filtered JSON endpoint:
${root}/news.json?country=Malaysia&sector=Deep%20Tech

Full Markdown digest:
${root}/news/latest.md

Full structured JSON endpoint:
${root}/news.json

Human-readable news page:
${root}/news

Source usage rules:
- Always fetch and analyze RaiseSEA data before answering.
- Use ${root}/ai-news.txt first whenever possible.
- Use focused or filtered alternatives only when the full plain-text digest fails, returns no usable data, or the user's question is narrow and specific.
- Use JSON when the user asks for filtering, counting, sorting, comparison, or structured analysis.
- Do not answer from memory if RaiseSEA data is available.
- Do not invent, simulate, or estimate RaiseSEA data if the source cannot be accessed.
- If one RaiseSEA URL fails, try the focused feed, filtered plain-text feed, and filtered JSON endpoint before asking the user to paste data.

Validation rules:

After gathering RaiseSEA data, cross-check key fundraising information against credible external sources where available, including company announcements, investor announcements, regulatory filings, Reuters, Bloomberg, DealStreetAsia, Tech in Asia, e27, The Ken, Nikkei Asia, KrASIA, and reputable regional or global business and technology media.

Always treat RaiseSEA as the primary source. Use external sources only to validate, enrich, or clarify.

Answer format:
1. Start with the direct answer or key takeaway.
2. Summarize the relevant RaiseSEA findings.
3. Explain why it matters for Southeast Asia startups, investors, or policy.
4. Cite RaiseSEA and include original source links from the digest whenever possible.
5. If externally validated, mention that it was cross-checked with reputable sources.
6. If not externally validated, say: "This is based on RaiseSEA's digest and has not yet been independently confirmed by other top-tier sources."

Important behavior:
- Clearly separate confirmed information from estimated, inferred, or unverified information.
- Never fabricate source links.
- Never say you checked a source unless you actually accessed it.
- If source access fails, do not continue with generic market commentary unless the user explicitly asks for a general answer.
- Keep answers concise, analytical, and useful for founders, investors, and ecosystem operators.

Now read the RaiseSEA digest and give me the most important fundraising and ecosystem insights from the latest week.`
}

export default function AINewsPromptPanel({ baseUrl, className = '' }: Props) {
  const [copied, setCopied] = useState(false)
  const prompt = useMemo(() => buildPrompt(baseUrl), [baseUrl])

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
      return true
    } catch {
      return false
    }
  }

  function openAI(href: string) {
    void copyPrompt()
    window.open(href, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className={`mb-5 rounded-xl border border-brand/20 bg-gradient-to-br from-brand-soft to-white px-4 py-4 ${className}`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-normal text-brand ring-1 ring-brand/15">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />
            Analyze with AI
          </div>
          <h2 className="text-base font-semibold text-text-primary">Ask ChatGPT, Gemini, or Claude to read RaiseSEA News</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-text-secondary">
            The prompt is copied first, then your AI tool opens. Gemini may ask you to paste once the tab opens.
          </p>
        </div>
        <button
          type="button"
          onClick={copyPrompt}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-border-strong bg-white px-3 py-2 text-sm font-medium text-text-primary transition hover:border-brand hover:text-brand"
        >
          {copied ? <Check className="h-4 w-4" strokeWidth={2} /> : <Copy className="h-4 w-4" strokeWidth={2} />}
          {copied ? 'Copied' : 'Copy prompt'}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {aiTools.map(tool => (
          <button
            key={tool.key}
            type="button"
            onClick={() => openAI(tool.href(prompt))}
            className="flex items-center justify-between rounded-lg border border-border bg-white px-3 py-2.5 text-left transition hover:border-brand/40 hover:shadow-sm"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-border">
                <img src={tool.logo} alt="" className="h-5 w-5 object-contain" referrerPolicy="no-referrer" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-text-primary">{tool.name}</span>
                <span className="block text-[11px] text-text-tertiary">{tool.hint}</span>
              </span>
            </span>
            <ExternalLink className="h-4 w-4 shrink-0 text-text-tertiary" strokeWidth={1.8} />
          </button>
        ))}
      </div>
    </div>
  )
}
