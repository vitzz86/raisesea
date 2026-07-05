import {
  buildNewsPlainText,
  getCurrentPublicNewsDigest,
  getPublicBaseUrl,
  publicNewsHeaders,
  publicNewsOptionsResponse,
} from '@/lib/public-news'

export const dynamic = 'force-dynamic'
export const revalidate = 600

export async function GET() {
  const digest = await getCurrentPublicNewsDigest()
  const text = buildNewsPlainText(digest, getPublicBaseUrl())

  return new Response(text, {
    headers: publicNewsHeaders('text/plain; charset=utf-8', {
      filename: 'raisesea-news-latest.txt',
    }),
  })
}

export const OPTIONS = publicNewsOptionsResponse
