import {
  buildNewsPlainText,
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
  const text = buildNewsPlainText(filteredDigest, getPublicBaseUrl(), {
    focused,
    filterLabel,
    title: focused ? 'RaiseSEA Focused News Digest' : undefined,
  })

  return new Response(text, {
    headers: publicNewsHeaders('text/plain; charset=utf-8', {
      filename: 'raisesea-ai-news.txt',
    }),
  })
}

export const OPTIONS = publicNewsOptionsResponse
