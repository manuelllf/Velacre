import type { MetadataRoute } from 'next'

const BASE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://velacre.com').replace(/\/$/, '')

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard',
        '/dashboard/',
        '/admin',
        '/admin/',
        '/onboarding',
        '/onboarding/',
        '/auth',
        '/auth/',
        '/settings',
        '/settings/',
        '/inicio',
        '/health',
        '/sales',
        '/api/',
      ],
    },
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  }
}
