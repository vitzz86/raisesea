import type { MetadataRoute } from 'next'
import {
  NEWS_JSON_PATH,
  NEWS_MARKDOWN_PATH,
  NEWS_RSS_PATH,
  NEWS_TEXT_ALIAS_PATH,
  NEWS_TEXT_PATH,
  getPublicBaseUrl,
} from '@/lib/public-news'

const allowPublic = [
  '/',
  '/news',
  '/news/',
  NEWS_TEXT_PATH,
  NEWS_TEXT_ALIAS_PATH,
  NEWS_MARKDOWN_PATH,
  NEWS_JSON_PATH,
  NEWS_RSS_PATH,
  '/llms.txt',
  '/glossary',
]
const disallowPrivate = [
  '/admin',
  '/api/',
  '/apply',
  '/crm',
  '/dashboard',
  '/experts',
  '/meet',
  '/mock-pitch',
  '/settings',
  '/tools/calculator',
]

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getPublicBaseUrl()

  return {
    rules: [
      {
        userAgent: '*',
        allow: allowPublic,
        disallow: disallowPrivate,
      },
      {
        userAgent: 'OAI-SearchBot',
        allow: allowPublic,
        disallow: disallowPrivate,
      },
      {
        userAgent: 'GPTBot',
        allow: allowPublic,
        disallow: disallowPrivate,
      },
      {
        userAgent: 'ChatGPT-User',
        allow: allowPublic,
        disallow: disallowPrivate,
      },
      {
        userAgent: 'Googlebot',
        allow: allowPublic,
        disallow: disallowPrivate,
      },
      {
        userAgent: 'Googlebot-News',
        allow: ['/news', '/news/', NEWS_TEXT_PATH, NEWS_TEXT_ALIAS_PATH, NEWS_MARKDOWN_PATH, NEWS_JSON_PATH, NEWS_RSS_PATH],
        disallow: disallowPrivate,
      },
      {
        userAgent: 'Google-Extended',
        allow: allowPublic,
        disallow: disallowPrivate,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}
