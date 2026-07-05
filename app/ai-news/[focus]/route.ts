import {
  buildNewsPlainText,
  describePublicNewsFilters,
  filterPublicNewsDigest,
  getCurrentPublicNewsDigest,
  getPublicBaseUrl,
  publicNewsFiltersFromFocusSlug,
  publicNewsFiltersFromSearchParams,
  publicNewsHeaders,
  publicNewsOptionsResponse,
} from '@/lib/public-news'

export const dynamic = 'force-dynamic'
export const revalidate = 600

export async function GET(
  request: Request,
  { params }: { params: Promise<{ focus: string }> }
) {
  const { focus } = await params
  const slugFilters = publicNewsFiltersFromFocusSlug(focus)
  const queryFilters = publicNewsFiltersFromSearchParams(new URL(request.url).searchParams)
  const filters = { ...slugFilters, ...queryFilters }
  const digest = await getCurrentPublicNewsDigest()
  const filteredDigest = filterPublicNewsDigest(digest, filters)
  const filterLabel = describePublicNewsFilters(filters)
  const text = buildNewsPlainText(filteredDigest, getPublicBaseUrl(), {
    focused: true,
    filterLabel,
    title: 'RaiseSEA Focused News Digest',
  })

  return new Response(text, {
    headers: publicNewsHeaders('text/plain; charset=utf-8', {
      filename: `raisesea-${focus.replace(/[^a-z0-9-]/gi, '-')}.txt`,
    }),
  })
}

export const OPTIONS = publicNewsOptionsResponse
