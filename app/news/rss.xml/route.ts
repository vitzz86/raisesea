import {
  buildNewsRssXml,
  getCurrentPublicNewsDigest,
  getPublicBaseUrl,
  publicNewsHeaders,
  publicNewsOptionsResponse,
} from '@/lib/public-news'

export const dynamic = 'force-dynamic'
export const revalidate = 600

export async function GET() {
  const digest = await getCurrentPublicNewsDigest()
  const xml = buildNewsRssXml(digest, getPublicBaseUrl())

  return new Response(xml, {
    headers: publicNewsHeaders('application/rss+xml; charset=utf-8', {
      filename: 'raisesea-news.xml',
    }),
  })
}

export const OPTIONS = publicNewsOptionsResponse
