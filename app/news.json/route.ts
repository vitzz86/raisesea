import {
  buildNewsJsonPayload,
  describePublicNewsFilters,
  filterPublicNewsDigest,
  getCurrentPublicNewsDigest,
  getPublicBaseUrl,
  hasPublicNewsFilters,
  publicNewsFiltersFromSearchParams,
  publicNewsHeaders,
  publicNewsOptionsResponse,
} from '@/lib/public-news'

export const dynamic = 'force-dynamic'
export const revalidate = 600

export async function GET(request: Request) {
  const filters = publicNewsFiltersFromSearchParams(new URL(request.url).searchParams)
  const focused = hasPublicNewsFilters(filters)
  const digest = await getCurrentPublicNewsDigest()
  const filteredDigest = focused ? filterPublicNewsDigest(digest, filters) : digest
  const filterLabel = focused ? describePublicNewsFilters(filters) : undefined
  const payload = buildNewsJsonPayload(filteredDigest, getPublicBaseUrl(), {
    filters: focused ? filters : undefined,
    filterLabel,
  })

  return Response.json(payload, {
    headers: publicNewsHeaders('application/json; charset=utf-8', {
      filename: 'raisesea-news.json',
    }),
  })
}

export const OPTIONS = publicNewsOptionsResponse
