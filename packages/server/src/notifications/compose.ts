import type { NotificationReason, Severity, VerificationStatus } from '@tamurt/shared';
import { getTranslator, isLocale, type Locale } from '@tamurt/shared/i18n';

export interface ComposeInput {
  locale: string | null | undefined;
  subcategoryId: string;
  communeName: string | null;
  placeLabel: string;
  reason: NotificationReason;
  status: VerificationStatus;
  severity: Severity;
  isDemo?: boolean;
}

/**
 * Message de notification localisé. Volontairement sobre : jamais présenté comme une alerte
 * gouvernementale officielle ; le statut de vérification est toujours mentionné.
 */
export function composeEventNotification(input: ComposeInput): { title: string; body: string } {
  const locale: Locale = isLocale(input.locale) ? input.locale : 'fr';
  const { tk } = getTranslator(locale);
  const what = tk(`subcategory.${input.subcategoryId}`);
  const where = input.communeName ? ` — ${input.communeName}` : '';
  const title = `${tk(`severity.${input.severity}`)} · ${what}${where}`.slice(0, 200);
  let lead: string;
  switch (input.reason) {
    case 'published':
      lead = tk('notifications.reason.published', { place: input.placeLabel });
      break;
    case 'status_upgraded':
      lead = tk('notifications.reason.status_upgraded', { status: tk(`status.${input.status}`) });
      break;
    case 'severity_raised':
      lead = tk('notifications.reason.severity_raised', {
        severity: tk(`severity.${input.severity}`),
      });
      break;
    case 'resolved':
      lead = tk('notifications.reason.resolved');
      break;
  }
  const status = input.reason === 'status_upgraded' ? '' : ` · ${tk(`status.${input.status}`)}`;
  return { title, body: `${lead}${status}`.slice(0, 1000) };
}
