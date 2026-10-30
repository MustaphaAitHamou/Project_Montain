import type { NextConfig } from 'next';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const mapStyleUrl = process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? '';

function origin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** Origines externes autorisées par la Content-Security-Policy (connect-src). */
const connectSources = [
  "'self'",
  origin(supabaseUrl),
  // Realtime Supabase (WebSocket)
  origin(supabaseUrl)?.replace(/^http/, 'ws'),
  origin(mapStyleUrl),
  ...(process.env.NEXT_PUBLIC_MAP_EXTRA_ORIGINS ?? '').split(',').map((s) => s.trim()),
].filter((v): v is string => Boolean(v));

const isDev = process.env.NODE_ENV !== 'production';

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js injecte des scripts inline pour l'hydratation ; 'unsafe-eval' uniquement en dev (HMR).
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${connectSources.filter((s) => s !== "'self'").join(' ')}`,
  "font-src 'self' data:",
  `connect-src ${connectSources.join(' ')}`,
  // MapLibre utilise des Web Workers créés depuis des blobs.
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    // Géolocalisation autorisée pour le site lui-même uniquement (déclenchée à la demande).
    value: 'geolocation=(self), camera=(), microphone=(), payment=(), usb=()',
  },
  ...(isDev
    ? []
    : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ['@tamurt/shared', '@tamurt/server'],
  serverExternalPackages: ['sharp', 'web-push'],
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
