import { buildNewsMarkdown, getCurrentPublicNewsDigest, getPublicBaseUrl } from '@/lib/public-news'

export const dynamic = 'force-dynamic'
export const revalidate = 600

export async function GET() {
  const digest = await getCurrentPublicNewsDigest()
  const markdown = buildNewsMarkdown(digest, getPublicBaseUrl())

  return new Response(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
    },
  })
}
