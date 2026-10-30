import webpush from 'web-push';
import { fetchWithRetry, type FetchLike } from '../http';

export interface PushMessage {
  title: string;
  body: string;
  data: Record<string, string>;
  critical: boolean;
}

export type ProviderResult =
  { ok: true; ticketId?: string } | { ok: false; invalidToken: boolean; error: string };

export interface ExpoProvider {
  send(tokens: string[], message: PushMessage): Promise<ProviderResult[]>;
  receipts(ticketIds: string[]): Promise<Record<string, ProviderResult>>;
}

export interface WebPushProvider {
  send(
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    message: PushMessage,
  ): Promise<ProviderResult>;
}

/**
 * Service Expo Push (https://docs.expo.dev/push-notifications/sending-notifications/).
 * Lots de 100 messages maximum ; les erreurs « DeviceNotRegistered » désactivent le jeton.
 */
export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
export const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

function ticketToResult(ticket: ExpoTicket | undefined): ProviderResult {
  if (ticket?.status === 'ok') return { ok: true, ticketId: ticket.id };
  const code = ticket?.details?.error ?? 'UnknownError';
  return {
    ok: false,
    invalidToken: code === 'DeviceNotRegistered',
    error: `${code}: ${ticket?.message ?? ''}`.slice(0, 500),
  };
}

export function createExpoProvider(
  options: { accessToken?: string | null; fetchImpl?: FetchLike } = {},
): ExpoProvider {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;
  return {
    async send(tokens, message) {
      const results: ProviderResult[] = [];
      for (let i = 0; i < tokens.length; i += 100) {
        const chunk = tokens.slice(i, i + 100);
        const body = chunk.map((to) => ({
          to,
          title: message.title,
          body: message.body,
          data: message.data,
          sound: 'default',
          priority: message.critical ? 'high' : 'normal',
          channelId: message.critical ? 'alerts-critical' : 'alerts',
          ttl: 6 * 3600,
        }));
        try {
          const response = await fetchWithRetry(
            EXPO_PUSH_URL,
            { method: 'POST', headers, body: JSON.stringify(body) },
            { retries: 2, fetchImpl: options.fetchImpl },
          );
          const json = (await response.json()) as { data?: ExpoTicket[] };
          chunk.forEach((_, index) => results.push(ticketToResult(json.data?.[index])));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          chunk.forEach(() =>
            results.push({ ok: false, invalidToken: false, error: message.slice(0, 500) }),
          );
        }
      }
      return results;
    },
    async receipts(ticketIds) {
      const out: Record<string, ProviderResult> = {};
      for (let i = 0; i < ticketIds.length; i += 1000) {
        const ids = ticketIds.slice(i, i + 1000);
        const response = await fetchWithRetry(
          EXPO_RECEIPTS_URL,
          { method: 'POST', headers, body: JSON.stringify({ ids }) },
          { retries: 2, fetchImpl: options.fetchImpl },
        );
        const json = (await response.json()) as { data?: Record<string, ExpoTicket> };
        for (const id of ids) {
          const receipt = json.data?.[id];
          if (receipt) out[id] = ticketToResult(receipt);
        }
      }
      return out;
    },
  };
}

/** Web Push (VAPID) via la bibliothèque `web-push`. 404/410 = abonnement expiré. */
export function createWebPushProvider(vapid: {
  subject: string;
  publicKey: string;
  privateKey: string;
}): WebPushProvider {
  return {
    async send(subscription, message) {
      try {
        await webpush.sendNotification(
          subscription,
          JSON.stringify({ title: message.title, body: message.body, data: message.data }),
          {
            TTL: 6 * 3600,
            urgency: message.critical ? 'high' : 'normal',
            vapidDetails: vapid,
          },
        );
        return { ok: true };
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        return {
          ok: false,
          invalidToken: status === 404 || status === 410,
          error: `WebPush ${status ?? ''} ${(error as Error).message ?? ''}`.trim().slice(0, 500),
        };
      }
    },
  };
}
