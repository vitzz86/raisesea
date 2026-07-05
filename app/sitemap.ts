import type { MetadataRoute } from 'next'
import { NEWS_JSON_PATH, NEWS_MARKDOWN_PATH, NEWS_RSS_PATH, getPublicBaseUrl } from '@/lib/public-news'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getPublicBaseUrl()
  const now = new Date()

  return [
    {
      url: `${baseUrl}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/news`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.95,
    },
    {
      url: `${baseUrl}${NEWS_MARKDOWN_PATH}`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}${NEWS_JSON_PATH}`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}${NEWS_RSS_PATH}`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/glossary`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ]
}
