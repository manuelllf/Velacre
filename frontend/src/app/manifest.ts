import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Velacre',
    short_name: 'Velacre',
    description: 'Gestiona y responde las reseñas de tu negocio con IA',
    start_url: '/inicio',
    display: 'standalone',
    background_color: '#0A0E1A',
    theme_color: '#0A0E1A',
    orientation: 'portrait',
    icons: [
      { src: '/icons/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
