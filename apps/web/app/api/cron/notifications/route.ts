import { NextResponse } from 'next/server';
import { checkExpoReceipts, processOutbox } from '@tamurt/server';
import { getProviders, getServiceClient, isAuthorizedCron } from '@/lib/server-services';
import { getPublicEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Tâche planifiée : traite l'outbox des notifications puis vérifie les accusés Expo. */
async function handle(request: Request) {
  if (!isAuthorizedCron(request))
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  const providers = getProviders();
  const outbox = await processOutbox(service, providers, { siteUrl: getPublicEnv().siteUrl });
  let receipts = 0;
  try {
    receipts = await checkExpoReceipts(service, providers);
  } catch {
    // Service Expo injoignable : les accusés seront vérifiés au prochain passage.
  }
  return NextResponse.json({ outbox, receipts });
}

export const GET = handle;
export const POST = handle;
