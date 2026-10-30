import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Droit d'accès : export JSON des données personnelles de l'utilisateur connecté. */
export async function GET() {
  const { supabase, user } = await getSession();
  if (!supabase || !user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  const { data, error } = await supabase.rpc('export_my_data');
  if (error) return NextResponse.json({ error: 'export_failed' }, { status: 500 });
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="tamurt-alerte-mes-donnees-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
