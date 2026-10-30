import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import {
  createExpoProvider,
  createWebPushProvider,
  type Providers,
  type ServiceClient,
} from '@tamurt/server';
import { getPublicEnv } from '@/lib/env';
import { getServerEnv } from '@/lib/env.server';
import { createServiceClient } from '@/lib/supabase/admin';

export function getServiceClient(): ServiceClient | null {
  return createServiceClient() as unknown as ServiceClient | null;
}

/** Fournisseurs de push configurés (désactivés proprement si une clé manque). */
export function getProviders(): Providers {
  const server = getServerEnv();
  const pub = getPublicEnv();
  return {
    expo: createExpoProvider({ accessToken: server.expoAccessToken }),
    webpush:
      pub.vapidPublicKey && server.vapidPrivateKey && server.vapidSubject
        ? createWebPushProvider({
            subject: server.vapidSubject,
            publicKey: pub.vapidPublicKey,
            privateKey: server.vapidPrivateKey,
          })
        : null,
  };
}

/** Vérifie l'en-tête `Authorization: Bearer <CRON_SECRET>` en temps constant. */
export function isAuthorizedCron(request: Request): boolean {
  const secret = getServerEnv().cronSecret;
  if (!secret) return false;
  const header = request.headers.get('authorization') ?? '';
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
