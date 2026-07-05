import {
  buildNewsMarkdown,
  getCurrentPublicNewsDigest,
  getPublicBaseUrl,
  publicNewsHeaders,
  publicNewsOptionsResponse,
} from '@/lib/public-news'

export const dynamic = 'force-dynamic'
export const revalidate = 600

export async function GET() {
  const digest = await getCurrentPublicNewsDigest()
  const markdown = buildNewsMarkdown(digest, getPublicBaseUrl())

  return new Response(markdown, {
    headers: publicNewsHeaders('text/markdown; charset=utf-8', {
      filename: 'raisesea-news-latest.md',
    }),
  })
}

export const OPTIONS = publicNewsOptionsResponse
