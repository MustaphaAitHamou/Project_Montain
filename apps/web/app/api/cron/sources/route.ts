import { NextResponse } from 'next/server';
import { ADAPTERS, runSourceSync } from '@tamurt/server';
import { getServiceClient, isAuthorizedCron } from '@/lib/server-services';
import { getServerEnv } from '@/lib/env.server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Tâche planifiée : synchronise une source (?source=emsc) ou toutes les sources activées.
 * Les sources désactivées, sans clé ou en disjonction sont ignorées et journalisées.
 */
async function handle(request: Request) {
  if (!isAuthorizedCron(request))
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  const requested = new URL(request.url).searchParams.get('source');
  const ids = requested ? [requested] : Object.keys(ADAPTERS);
  const env = getServerEnv();
  const results: Record<string, unknown> = {};
  for (const id of ids) {
    results[id] = await runSourceSync(service, id, {
      secrets: { nasaFirmsMapKey: env.nasaFirmsMapKey, openMeteoApiKey: env.openMeteoApiKey },
      trigger: 'schedule',
    });
  }
  return NextResponse.json({ results });
}

export const GET = handle;
export const POST = handle;
