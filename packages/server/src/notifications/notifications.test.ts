import { describe, expect, it, vi } from 'vitest';
import { composeEventNotification } from './compose';
import { planRecipients } from './dispatcher';
import { createExpoProvider } from './providers';

const base = {
  distance_m: 1000,
  place_categories: [] as string[],
  place_min_severity: null,
  place_notify: true,
  push_enabled: true,
  web_push_enabled: false,
  min_severity: 'vigilance' as const,
  include_unverified: false,
  updates_enabled: true,
  resolution_enabled: true,
  quiet_hours_enabled: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '07:00',
  timezone: 'Africa/Algiers',
  locale: 'fr',
};

describe('composition des notifications', () => {
  it('mentionne le statut et ne se présente pas comme officielle', () => {
    const { title, body } = composeEventNotification({
      locale: 'fr',
      subcategoryId: 'fire.smoke',
      communeName: 'Tizi Ouzou',
      placeLabel: 'Village de mes parents',
      reason: 'published',
      status: 'under_review',
      severity: 'vigilance',
    });
    expect(title).toBe('Vigilance · Fumée signalée — Tizi Ouzou');
    expect(body).toBe('Nouvel événement près de Village de mes parents · En cours de vérification');
    expect(`${title} ${body}`).not.toMatch(/officiel/i);
  });
  it('traduit en arabe', () => {
    const { title } = composeEventNotification({
      locale: 'ar',
      subcategoryId: 'flood.landslide',
      communeName: 'تيزي وزو',
      placeLabel: 'x',
      reason: 'resolved',
      status: 'resolved',
      severity: 'important',
    });
    expect(title).toContain('انزلاق تربة');
  });
});

describe('planification des destinataires', () => {
  const noon = new Date('2026-07-15T11:00:00Z');
  it('retient le lieu le plus proche qui autorise un push', () => {
    const planned = planRecipients(
      [
        {
          ...base,
          user_id: 'u1',
          followed_place_id: 'p-far',
          place_label: 'Loin',
          distance_m: 9000,
        },
        {
          ...base,
          user_id: 'u1',
          followed_place_id: 'p-near',
          place_label: 'Près',
          distance_m: 500,
          place_categories: ['traffic'],
        },
      ],
      { categoryId: 'fire', status: 'confirmed', severity: 'important' },
      'published',
      noon,
    );
    // Le lieu le plus proche ne suit que la circulation : on retient le second.
    expect(planned).toEqual([
      expect.objectContaining({ userId: 'u1', channel: 'push', placeLabel: 'Loin' }),
    ]);
  });
  it('exclut un utilisateur dont aucun lieu ne correspond', () => {
    const planned = planRecipients(
      [{ ...base, user_id: 'u2', followed_place_id: 'p', place_label: 'X', place_notify: false }],
      { categoryId: 'fire', status: 'confirmed', severity: 'important' },
      'published',
      noon,
    );
    expect(planned).toEqual([]);
  });
});

describe('fournisseur Expo Push', () => {
  it('envoie par lots, mappe les tickets et détecte les jetons invalides', async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const messages = JSON.parse(String(init?.body)) as unknown[];
      expect(messages).toHaveLength(2);
      return new Response(
        JSON.stringify({
          data: [
            { status: 'ok', id: 'ticket-1' },
            {
              status: 'error',
              message: 'not registered',
              details: { error: 'DeviceNotRegistered' },
            },
          ],
        }),
        { status: 200 },
      );
    });
    const provider = createExpoProvider({ fetchImpl });
    const results = await provider.send(['ExponentPushToken[a]', 'ExponentPushToken[b]'], {
      title: 't',
      body: 'b',
      data: {},
      critical: false,
    });
    expect(results[0]).toEqual({ ok: true, ticketId: 'ticket-1' });
    expect(results[1]).toMatchObject({ ok: false, invalidToken: true });
  });
});
