import type { MetadataRoute } from 'next'

const BASE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://velacre.com').replace(/\/$/, '')

const LANGUAGES = {
  'es-ES': `${BASE}/es`,
  'gl-ES': `${BASE}/gal`,
  'en-US': `${BASE}/en`,
  'x-default': `${BASE}/`,
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    {
      url: `${BASE}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
      alternates: { languages: LANGUAGES },
    },
    {
      url: `${BASE}/es`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
      alternates: { languages: LANGUAGES },
    },
    {
      url: `${BASE}/gal`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
      alternates: { languages: LANGUAGES },
    },
    {
      url: `${BASE}/en`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
      alternates: { languages: LANGUAGES },
    },
    {
      url: `${BASE}/privacidad`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE}/terminos`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE}/contacto`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.4,
    },
  ]
}
