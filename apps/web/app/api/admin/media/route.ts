import { NextResponse } from 'next/server';
import { z } from 'zod';
import { moderateMedia } from '@tamurt/server';
import { getSession, isStaff } from '@/lib/auth';
import { getServiceClient } from '@/lib/server-services';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ mediaId: z.uuid(), approve: z.boolean() });

/** Décision sur une photo en quarantaine : réservée à l'équipe de modération (vérifiée ici). */
export async function POST(request: Request) {
  const { user } = await getSession();
  if (!user || !isStaff(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  try {
    const result = await moderateMedia(service, parsed.data.mediaId, parsed.data.approve, user.id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'failed' },
      { status: 422 },
    );
  }
}
