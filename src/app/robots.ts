import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://lobby.market'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Keep private user pages and API routes out of crawl
        disallow: [
          '/api/',
          '/(auth)/',
          '/login',
          '/signup',
          '/settings',
          '/analytics',
          '/profile/me',
          '/profile/settings',
          '/moderation',
          '/coalition-invites',
          '/onboarding',
          '/clout',
        ],
      },
      {
        // Block AI training scrapers from user-generated content
        userAgent: [
          'GPTBot',
          'ChatGPT-User',
          'CCBot',
          'anthropic-ai',
          'Claude-Web',
          'Omgilibot',
          'FacebookBot',
        ],
        disallow: '/',
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}
