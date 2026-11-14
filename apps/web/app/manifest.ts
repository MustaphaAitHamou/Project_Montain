import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Tamurt Alerte',
    short_name: 'Tamurt Alerte',
    description: 'Veillons ensemble sur notre terre.',
    start_url: '/',
    display: 'standalone',
    background_color: '#141312',
    theme_color: '#D9261C',
    lang: 'fr',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/brand/icone.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
}
