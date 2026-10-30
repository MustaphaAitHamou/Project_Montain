import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADAPTERS, runSourceSync } from '@tamurt/server';
import { adminMfaSatisfied, getSession, isAdmin } from '@/lib/auth';
import { getServiceClient } from '@/lib/server-services';
import { getServerEnv } from '@/lib/env.server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const bodySchema = z.object({
  sourceId: z.string().refine((id) => id in ADAPTERS),
  action: z.enum(['sync', 'enable', 'disable']),
});

/** Administration des sources externes (administrateurs, MFA si exigé). */
export async function POST(request: Request) {
  const { user } = await getSession();
  if (!user || !isAdmin(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!adminMfaSatisfied(user))
    return NextResponse.json({ error: 'mfa_required' }, { status: 403 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  const { sourceId, action } = parsed.data;
  if (action !== 'sync') {
    await service
      .from('alert_sources')
      .update({ enabled: action === 'enable' })
      .eq('id', sourceId);
    await service.rpc('service_log_audit', {
      p_actor_id: user.id,
      p_action: `source.${action}d`,
      p_target_type: 'source',
      p_target_id: sourceId,
      p_metadata: {},
    });
    return NextResponse.json({ ok: true });
  }
  const env = getServerEnv();
  const outcome = await runSourceSync(service, sourceId, {
    secrets: { nasaFirmsMapKey: env.nasaFirmsMapKey, openMeteoApiKey: env.openMeteoApiKey },
    trigger: 'manual',
  });
  return NextResponse.json(outcome);
}
