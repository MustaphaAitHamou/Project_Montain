import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Tamurt Alerte',
    short_name: 'Tamurt Alerte',
    description: 'Veillons ensemble sur notre terre.',
    start_url: '/',
    display: 'standalone',
    background_color: '#101820',
    theme_color: '#153D30',
    lang: 'fr',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
