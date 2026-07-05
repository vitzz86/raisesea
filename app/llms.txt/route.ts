import {
  NEWS_JSON_PATH,
  NEWS_MARKDOWN_PATH,
  NEWS_RSS_PATH,
  NEWS_TEXT_ALIAS_PATH,
  NEWS_TEXT_PATH,
  getPublicBaseUrl,
  publicNewsHeaders,
  publicNewsOptionsResponse,
} from '@/lib/public-news'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

export async function GET() {
  const baseUrl = getPublicBaseUrl()
  const body = `# RaiseSEA

> RaiseSEA is a fundraising intelligence workspace for Southeast Asian founders. It provides pitch deck analysis, investor matching, mock pitch practice, fundraising CRM, calculators, glossary, and a weekly SEA fundraising digest.

Important notes for AI agents and crawlers:
- The public weekly news digest is available at ${baseUrl}/news.
- The simplest plain-text digest for AI readers is available at ${baseUrl}${NEWS_TEXT_PATH}.
- The complete AI-readable digest is available at ${baseUrl}${NEWS_MARKDOWN_PATH}.
- A no-extension plain-text alias is available at ${baseUrl}${NEWS_TEXT_ALIAS_PATH}.
- Structured JSON for every approved story is available at ${baseUrl}${NEWS_JSON_PATH}.
- RSS is available at ${baseUrl}${NEWS_RSS_PATH}.
- Public news content includes headlines, summaries, why-it-matters notes, source links, category, sector, country, stage, amount, lead investor, and publish date when available.
- Authenticated product pages such as deck analysis, mock pitch, CRM, and calculators require Google sign-in and should not be crawled as public content.

## Core Public Pages

- [RaiseSEA home](${baseUrl}/): Product overview for SEA founders.
- [Weekly SEA fundraising news](${baseUrl}/news): Human-readable digest.
- [Plain text AI digest](${baseUrl}${NEWS_TEXT_PATH}): Lowest-friction full digest for AI readers.
- [Latest digest in Markdown](${baseUrl}${NEWS_MARKDOWN_PATH}): Full AI-readable digest.
- [No-extension AI digest alias](${baseUrl}${NEWS_TEXT_ALIAS_PATH}): Plain text alias for crawlers that dislike dotted URLs.
- [Latest digest in JSON](${baseUrl}${NEWS_JSON_PATH}): Structured full digest.
- [News RSS feed](${baseUrl}${NEWS_RSS_PATH}): RSS feed for current approved stories.
- [Fundraising glossary](${baseUrl}/glossary): Plain-English fundraising terms.

## Optional Context

- [Sitemap](${baseUrl}/sitemap.xml)
- [Robots policy](${baseUrl}/robots.txt)
`

  return new Response(body, {
    headers: publicNewsHeaders('text/plain; charset=utf-8', {
      cache: 'long',
      filename: 'llms.txt',
    }),
  })
}

export const OPTIONS = publicNewsOptionsResponse
