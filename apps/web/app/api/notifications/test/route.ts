import { NextResponse } from 'next/server';
import { sendTestNotification } from '@tamurt/server';
import { getTranslator, isLocale } from '@tamurt/shared/i18n';
import { getSession } from '@/lib/auth';
import { getProviders, getServiceClient } from '@/lib/server-services';

export const dynamic = 'force-dynamic';

/** Notification de test envoyée à l'utilisateur connecté uniquement (1 par minute au plus). */
export async function POST() {
  const { user } = await getSession();
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  const { t } = getTranslator(isLocale(user.preferredLocale) ? user.preferredLocale : 'fr');
  const result = await sendTestNotification(service, getProviders(), user.id, {
    title: t('notifications.testTitle'),
    body: t('notifications.testBody'),
  });
  if (!result.created) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  return NextResponse.json(result);
}
