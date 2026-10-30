import { NextResponse } from 'next/server';
import { getPublicEnv, isSupabaseConfigured } from '@/lib/env';

/**
 * Sonde de santé : indique si l'application est démarrée et si le backend est configuré.
 * Ne divulgue aucune valeur de configuration.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const env = getPublicEnv();
  const configured = isSupabaseConfigured(env);
  let backend: 'not_configured' | 'reachable' | 'unreachable' = 'not_configured';
  if (configured && env.supabaseUrl) {
    try {
      const res = await fetch(`${env.supabaseUrl}/auth/v1/health`, {
        headers: { apikey: env.supabasePublishableKey ?? '' },
        signal: AbortSignal.timeout(3000),
        cache: 'no-store',
      });
      backend = res.ok ? 'reachable' : 'unreachable';
    } catch {
      backend = 'unreachable';
    }
  }
  return NextResponse.json(
    { status: 'ok', backend, demoMode: env.demoMode, time: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
