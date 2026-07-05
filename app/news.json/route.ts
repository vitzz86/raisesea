import { buildNewsJsonPayload, getCurrentPublicNewsDigest, getPublicBaseUrl } from '@/lib/public-news'

export const dynamic = 'force-dynamic'
export const revalidate = 600

export async function GET() {
  const digest = await getCurrentPublicNewsDigest()
  const payload = buildNewsJsonPayload(digest, getPublicBaseUrl())

  return Response.json(payload, {
    headers: {
      'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
    },
  })
}
