import {
  MAX_NON_CRITICAL_PUSH_PER_HOUR,
  buildDedupKey,
  decideDelivery,
  type CategoryId,
  type NotificationReason,
  type Severity,
  type VerificationStatus,
} from '@tamurt/shared';
import type { ServiceClient } from '../supabase';
import { composeEventNotification } from './compose';
import type { ExpoProvider, PushMessage, WebPushProvider } from './providers';

export interface Providers {
  expo: ExpoProvider | null;
  webpush: WebPushProvider | null;
}

export interface OutboxResult {
  processed: number;
  recipients: number;
  pushes: number;
  failures: number;
}

interface Candidate {
  user_id: string;
  followed_place_id: string;
  place_label: string;
  distance_m: number;
  place_categories: string[];
  place_min_severity: Severity | null;
  place_notify: boolean;
  push_enabled: boolean;
  web_push_enabled: boolean;
  min_severity: Severity;
  include_unverified: boolean;
  updates_enabled: boolean;
  resolution_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  timezone: string;
  locale: string;
}

interface Planned {
  userId: string;
  channel: 'push' | 'inbox_only';
  pushEnabled: boolean;
  webPushEnabled: boolean;
  locale: string;
  placeLabel: string;
}

/** Choisit, pour chaque utilisateur, le premier lieu suivi (le plus proche) qui autorise la remise. */
export function planRecipients(
  candidates: Candidate[],
  event: { categoryId: CategoryId; status: VerificationStatus; severity: Severity },
  reason: NotificationReason,
  now: Date,
): Planned[] {
  const byUser = new Map<string, Candidate[]>();
  for (const c of candidates) {
    const list = byUser.get(c.user_id) ?? [];
    list.push(c);
    byUser.set(c.user_id, list);
  }
  const planned: Planned[] = [];
  for (const [userId, places] of byUser) {
    places.sort((a, b) => a.distance_m - b.distance_m);
    let best: Planned | null = null;
    for (const place of places) {
      const decision = decideDelivery(
        { categoryId: event.categoryId, status: event.status, severity: event.severity, reason },
        {
          pushEnabled: place.push_enabled || place.web_push_enabled,
          minSeverity: place.min_severity,
          includeUnverified: place.include_unverified,
          updatesEnabled: place.updates_enabled,
          resolutionEnabled: place.resolution_enabled,
          quietHoursEnabled: place.quiet_hours_enabled,
          quietHoursStart: place.quiet_hours_start,
          quietHoursEnd: place.quiet_hours_end,
          timezone: place.timezone,
        },
        {
          categories: place.place_categories as CategoryId[],
          minSeverity: place.place_min_severity,
          notify: place.place_notify,
        },
        now,
      );
      if (!decision.notify) continue;
      const candidate: Planned = {
        userId,
        channel: decision.channel,
        pushEnabled: place.push_enabled,
        webPushEnabled: place.web_push_enabled,
        locale: place.locale,
        placeLabel: place.place_label,
      };
      if (decision.channel === 'push') {
        best = candidate;
        break;
      }
      best ??= candidate;
    }
    if (best) planned.push(best);
  }
  return planned;
}

async function recentPushCount(
  service: ServiceClient,
  userId: string,
  since: Date,
): Promise<number> {
  const { count } = await service
    .from('user_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('channel', 'push')
    .neq('severity', 'critical')
    .gte('created_at', since.toISOString());
  return count ?? 0;
}

/** Envoie un message à tous les appareils actifs d'un utilisateur et journalise chaque remise. */
export async function deliverToUser(
  service: ServiceClient,
  providers: Providers,
  notificationId: string,
  userId: string,
  message: PushMessage,
  channels: { expo: boolean; webpush: boolean },
): Promise<{ sent: number; failed: number }> {
  const { data: tokens } = await service
    .from('device_push_tokens')
    .select('id, kind, token, web_push_keys')
    .eq('user_id', userId)
    .eq('enabled', true);
  let sent = 0;
  let failed = 0;
  const record = async (
    tokenId: string,
    channel: 'expo' | 'webpush',
    ok: boolean,
    ticketId: string | null,
    error: string | null,
    invalid: boolean,
  ) => {
    await service.from('notification_deliveries').insert({
      notification_id: notificationId,
      device_token_id: tokenId,
      channel,
      status: ok ? 'sent' : invalid ? 'invalid_token' : 'failed',
      provider_ticket_id: ticketId,
      error,
    });
    if (invalid) {
      await service
        .from('device_push_tokens')
        .update({ enabled: false, disabled_at: new Date().toISOString(), last_error: error })
        .eq('id', tokenId);
    } else if (!ok) {
      await service.rpc('increment_token_failure', { p_token_id: tokenId, p_error: error ?? '' });
    }
    if (ok) sent += 1;
    else failed += 1;
  };

  const expoTokens = (tokens ?? []).filter((t) => t.kind === 'expo');
  if (channels.expo && providers.expo && expoTokens.length > 0) {
    const results = await providers.expo.send(
      expoTokens.map((t) => t.token),
      message,
    );
    for (const [i, result] of results.entries()) {
      const token = expoTokens[i];
      if (!token) continue;
      await record(
        token.id,
        'expo',
        result.ok,
        result.ok ? (result.ticketId ?? null) : null,
        result.ok ? null : result.error,
        !result.ok && result.invalidToken,
      );
    }
  }
  const webTokens = (tokens ?? []).filter((t) => t.kind === 'webpush');
  if (channels.webpush && providers.webpush) {
    for (const token of webTokens) {
      const keys = token.web_push_keys as { p256dh?: string; auth?: string } | null;
      if (!keys?.p256dh || !keys.auth) continue;
      const result = await providers.webpush.send(
        { endpoint: token.token, keys: { p256dh: keys.p256dh, auth: keys.auth } },
        message,
      );
      await record(
        token.id,
        'webpush',
        result.ok,
        null,
        result.ok ? null : result.error,
        !result.ok && result.invalidToken,
      );
    }
  }
  return { sent, failed };
}

/**
 * Traite l'outbox : pour chaque changement notable d'un événement public, calcule les
 * destinataires (PostGIS), applique les règles (@tamurt/shared), l'anti-spam et la
 * déduplication, crée les notifications in-app puis envoie les push.
 */
export async function processOutbox(
  service: ServiceClient,
  providers: Providers,
  options: { batchSize?: number; now?: () => Date; maxPushPerHour?: number; siteUrl?: string } = {},
): Promise<OutboxResult> {
  const now = options.now?.() ?? new Date();
  const result: OutboxResult = { processed: 0, recipients: 0, pushes: 0, failures: 0 };
  const { data: rows, error } = await service
    .from('notification_outbox')
    .select('*')
    .in('status', ['pending', 'failed'])
    .lt('attempts', 5)
    .order('created_at', { ascending: true })
    .limit(options.batchSize ?? 20);
  if (error) throw new Error(`outbox: ${error.message}`);

  for (const row of rows ?? []) {
    // Réservation atomique de la ligne (évite un double traitement par deux exécutions concurrentes).
    const { data: claimed } = await service
      .from('notification_outbox')
      .update({ status: 'processing', attempts: row.attempts + 1 })
      .eq('id', row.id)
      .in('status', ['pending', 'failed'])
      .select('id')
      .maybeSingle();
    if (!claimed) continue;
    try {
      // Une version plus récente du même événement a déjà son entrée : celle-ci est obsolète
      // (évite « Nouvel événement » + « Mise à jour » envoyés coup sur coup après un retard).
      const { count: newer } = await service
        .from('notification_outbox')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', row.event_id)
        .gt('event_version', row.event_version);
      if ((newer ?? 0) > 0) {
        await service
          .from('notification_outbox')
          .update({
            status: 'done',
            recipients_count: 0,
            push_count: 0,
            last_error: 'superseded',
            processed_at: new Date().toISOString(),
          })
          .eq('id', row.id);
        result.processed += 1;
        continue;
      }
      const { data: event } = await service
        .from('event_feed')
        .select('*')
        .eq('id', row.event_id)
        .maybeSingle();
      if (
        !event ||
        !event.is_public ||
        event.is_demo ||
        !event.category_id ||
        !event.status ||
        !event.severity
      ) {
        await service
          .from('notification_outbox')
          .update({
            status: 'done',
            recipients_count: 0,
            push_count: 0,
            processed_at: new Date().toISOString(),
          })
          .eq('id', row.id);
        result.processed += 1;
        continue;
      }
      const reason = row.reason as NotificationReason;
      const { data: candidates, error: candidatesError } = await service.rpc(
        'notification_candidates',
        {
          p_event_id: row.event_id,
        },
      );
      if (candidatesError) throw new Error(candidatesError.message);
      const planned = planRecipients(
        (candidates ?? []) as Candidate[],
        {
          categoryId: event.category_id as CategoryId,
          status: event.status,
          severity: event.severity,
        },
        reason,
        now,
      );
      const dedupKey = buildDedupKey(row.event_id, reason, row.event_version);
      const hourAgo = new Date(now.getTime() - 3600_000);
      let pushes = 0;
      for (const p of planned) {
        let channel = p.channel;
        if (channel === 'push' && event.severity !== 'critical') {
          const recent = await recentPushCount(service, p.userId, hourAgo);
          if (recent >= (options.maxPushPerHour ?? MAX_NON_CRITICAL_PUSH_PER_HOUR))
            channel = 'inbox_only';
        }
        const communeName =
          p.locale === 'ar'
            ? (event.commune_name_ar ?? event.commune_name_fr)
            : event.commune_name_fr;
        const { title, body } = composeEventNotification({
          locale: p.locale,
          subcategoryId: event.subcategory_id ?? '',
          communeName,
          placeLabel: p.placeLabel,
          reason,
          status: event.status,
          severity: event.severity,
        });
        const { data: inserted } = await service
          .from('user_notifications')
          .upsert(
            {
              user_id: p.userId,
              event_id: row.event_id,
              kind: 'event',
              reason,
              title,
              body,
              severity: event.severity,
              data: { eventId: row.event_id, url: `/alertes/${row.event_id}` },
              dedup_key: dedupKey,
              channel,
            },
            { onConflict: 'user_id,dedup_key', ignoreDuplicates: true },
          )
          .select('id');
        const notificationId = inserted?.[0]?.id;
        if (!notificationId) continue; // déjà notifié (déduplication)
        result.recipients += 1;
        if (channel === 'push') {
          const delivery = await deliverToUser(
            service,
            providers,
            notificationId,
            p.userId,
            {
              title,
              body,
              data: {
                eventId: row.event_id,
                url: `${options.siteUrl ?? ''}/alertes/${row.event_id}`,
              },
              critical: event.severity === 'critical',
            },
            { expo: p.pushEnabled, webpush: p.webPushEnabled },
          );
          pushes += delivery.sent;
          result.failures += delivery.failed;
        }
      }
      result.pushes += pushes;
      await service
        .from('notification_outbox')
        .update({
          status: 'done',
          recipients_count: planned.length,
          push_count: pushes,
          processed_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('id', row.id);
      result.processed += 1;
    } catch (err) {
      await service
        .from('notification_outbox')
        .update({
          status: 'failed',
          last_error: (err instanceof Error ? err.message : String(err)).slice(0, 500),
        })
        .eq('id', row.id);
      result.failures += 1;
    }
  }
  return result;
}

/** Vérifie les accusés Expo des envois passés ; désactive les jetons invalides. */
export async function checkExpoReceipts(
  service: ServiceClient,
  providers: Providers,
): Promise<number> {
  if (!providers.expo) return 0;
  const { data: pending } = await service
    .from('notification_deliveries')
    .select('id, provider_ticket_id, device_token_id')
    .eq('status', 'sent')
    .eq('channel', 'expo')
    .is('receipt_checked_at', null)
    .lte('created_at', new Date(Date.now() - 15 * 60_000).toISOString())
    .limit(1000);
  const withTickets = (pending ?? []).filter((d) => d.provider_ticket_id);
  if (withTickets.length === 0) return 0;
  const receipts = await providers.expo.receipts(
    withTickets.map((d) => d.provider_ticket_id as string),
  );
  for (const d of withTickets) {
    const receipt = receipts[d.provider_ticket_id as string];
    if (!receipt) continue;
    await service
      .from('notification_deliveries')
      .update({
        status: receipt.ok ? 'delivered' : receipt.invalidToken ? 'invalid_token' : 'failed',
        error: receipt.ok ? null : receipt.error,
        receipt_checked_at: new Date().toISOString(),
      })
      .eq('id', d.id);
    if (!receipt.ok && receipt.invalidToken && d.device_token_id) {
      await service
        .from('device_push_tokens')
        .update({
          enabled: false,
          disabled_at: new Date().toISOString(),
          last_error: receipt.error,
        })
        .eq('id', d.device_token_id);
    }
  }
  return withTickets.length;
}

/** Notification de test vers l'utilisateur lui-même (au plus une par minute). */
export async function sendTestNotification(
  service: ServiceClient,
  providers: Providers,
  userId: string,
  message: { title: string; body: string },
): Promise<{ created: boolean; sent: number; failed: number }> {
  const minute = new Date().toISOString().slice(0, 16);
  const { data: inserted } = await service
    .from('user_notifications')
    .upsert(
      {
        user_id: userId,
        kind: 'test',
        title: message.title,
        body: message.body,
        severity: 'information',
        data: {},
        dedup_key: `test:${minute}`,
        channel: 'push',
      },
      { onConflict: 'user_id,dedup_key', ignoreDuplicates: true },
    )
    .select('id');
  const notificationId = inserted?.[0]?.id;
  if (!notificationId) return { created: false, sent: 0, failed: 0 };
  const delivery = await deliverToUser(
    service,
    providers,
    notificationId,
    userId,
    { ...message, data: { kind: 'test' }, critical: false },
    { expo: true, webpush: true },
  );
  return { created: true, ...delivery };
}
