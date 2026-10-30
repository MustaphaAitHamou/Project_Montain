import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ALGER,
  closeDb,
  createUser,
  deleteCreatedUsers,
  reportParams,
  serviceClient,
  type TestUser,
} from './helpers';

let diaspora: TestUser;
let other: TestUser;
let moderator: TestUser;
let eventId: string;

beforeAll(async () => {
  diaspora = await createUser('diaspora');
  other = await createUser('autre');
  moderator = await createUser('modo-suivi', ['moderator']);
  const reporter = await createUser('temoin');
  const { data } = await reporter.client.rpc(
    'submit_report',
    reportParams({ p_lat: 36.7, p_lng: 4.06 }),
  );
  const approve = await moderator.client.rpc('moderate_approve_report', {
    p_report_id: data.report_id,
    p_mode: 'new_event',
    p_event_id: null,
    p_status: 'corroborated',
    p_severity: 'important',
  });
  if (approve.error) throw approve.error;
  eventId = approve.data as string;
});

afterAll(async () => {
  await deleteCreatedUsers();
  await closeDb();
});

describe('Mes villages', () => {
  it('suit une commune sans géolocalisation et calcule la position côté serveur', async () => {
    const { data, error } = await diaspora.client
      .from('user_followed_places')
      .insert({
        user_id: diaspora.id,
        label: 'Commune de mes parents',
        place_type: 'commune',
        commune_code: '1501',
        // Position fournie volontairement fausse : elle doit être remplacée par le centre de la commune.
        location: 'SRID=4326;POINT(0 0)',
        radius_m: 2000,
      })
      .select('id')
      .single();
    expect(error).toBeNull();
    const { data: summary } = await diaspora.client.rpc('my_followed_places_summary');
    const place = summary?.find((p: { id: string }) => p.id === data?.id);
    expect(place).toMatchObject({ commune_name_fr: 'Tizi Ouzou', wilaya_name_fr: 'Tizi Ouzou' });
    expect(place.lat).toBeGreaterThan(36.5);
    // L'événement corroboré dans la commune est compté comme alerte active connue.
    expect(place.active_events).toBeGreaterThanOrEqual(1);
  });

  it('suit un lieu personnalisé placé sur la carte et refuse une zone non couverte', async () => {
    const ok = await diaspora.client.from('user_followed_places').insert({
      user_id: diaspora.id,
      label: 'Mon village',
      place_type: 'custom',
      location: 'SRID=4326;POINT(4.2 36.63)',
      radius_m: 3000,
      categories: ['fire', 'flood'],
    });
    expect(ok.error).toBeNull();
    const outside = await diaspora.client.from('user_followed_places').insert({
      user_id: diaspora.id,
      label: 'Alger',
      place_type: 'custom',
      location: `SRID=4326;POINT(${ALGER.lng} ${ALGER.lat})`,
      radius_m: 3000,
    });
    expect(outside.error?.message).toContain('outside_coverage');
  });

  it('refuse de créer un lieu pour un autre utilisateur et isole les listes', async () => {
    const forged = await other.client.from('user_followed_places').insert({
      user_id: diaspora.id,
      label: 'usurpation',
      place_type: 'commune',
      commune_code: '1501',
      location: 'SRID=4326;POINT(0 0)',
    });
    expect(forged.error).not.toBeNull();
    const { data } = await other.client.from('user_followed_places').select('id');
    expect(data).toEqual([]);
  });

  it('refuse une catégorie inconnue', async () => {
    const { error } = await diaspora.client.from('user_followed_places').insert({
      user_id: diaspora.id,
      label: 'x',
      place_type: 'commune',
      commune_code: '1502',
      location: 'SRID=4326;POINT(0 0)',
      categories: ['volcan'],
    });
    expect(error?.message).toContain('unknown_category');
  });
});

describe('préférences et ciblage des notifications', () => {
  it('crée des préférences par défaut et ne permet de modifier que les siennes', async () => {
    const { data } = await diaspora.client
      .from('notification_preferences')
      .select('min_severity, include_unverified, timezone')
      .single();
    expect(data).toEqual({
      min_severity: 'vigilance',
      include_unverified: false,
      timezone: 'Africa/Algiers',
    });
    const update = await diaspora.client
      .from('notification_preferences')
      .update({ quiet_hours_enabled: true, quiet_hours_start: '23:00', quiet_hours_end: '06:30' })
      .eq('user_id', diaspora.id)
      .select('quiet_hours_start');
    expect(update.data?.[0]?.quiet_hours_start).toBe('23:00:00');
    const tamper = await other.client
      .from('notification_preferences')
      .update({ push_enabled: false })
      .eq('user_id', diaspora.id)
      .select('user_id');
    expect(tamper.data).toEqual([]);
  });

  it('calcule les destinataires géographiques côté serveur uniquement', async () => {
    const denied = await diaspora.client.rpc('notification_candidates', { p_event_id: eventId });
    expect(denied.error).not.toBeNull();
    const { data, error } = await serviceClient().rpc('notification_candidates', {
      p_event_id: eventId,
    });
    expect(error).toBeNull();
    const rows = (data ?? []) as {
      user_id: string;
      place_label: string;
      quiet_hours_start: string;
    }[];
    const mine = rows.filter((r) => r.user_id === diaspora.id);
    expect(mine.map((r) => r.place_label)).toContain('Commune de mes parents');
    expect(mine[0]?.quiet_hours_start).toBe('23:00');
    expect(rows.some((r) => r.user_id === other.id)).toBe(false);
  });

  it('enregistre un jeton Expo valide et refuse un jeton mal formé', async () => {
    const ok = await diaspora.client.rpc('register_push_token', {
      p_kind: 'expo',
      p_platform: 'android',
      p_token: 'ExponentPushToken[test-token-123]',
    });
    expect(ok.error).toBeNull();
    const bad = await diaspora.client.rpc('register_push_token', {
      p_kind: 'expo',
      p_platform: 'android',
      p_token: 'pas-un-jeton',
    });
    expect(bad.error?.message).toContain('invalid_token');
    // Le même appareil connecté à un autre compte est réattribué.
    await other.client.rpc('register_push_token', {
      p_kind: 'expo',
      p_platform: 'android',
      p_token: 'ExponentPushToken[test-token-123]',
    });
    const { data } = await diaspora.client.from('device_push_tokens').select('id');
    expect(data).toEqual([]);
  });

  it('limite à 10 appareils mais accepte le réenregistrement d’un appareil connu', async () => {
    const register = (n: number) =>
      diaspora.client.rpc('register_push_token', {
        p_kind: 'expo',
        p_platform: 'ios',
        p_token: `ExponentPushToken[limit-${diaspora.id.slice(0, 8)}-${n}]`,
      });
    for (let n = 1; n <= 10; n += 1) expect((await register(n)).error).toBeNull();
    expect((await register(11)).error?.message).toContain('device_limit_reached');
    // Le même téléphone renouvelle son jeton au démarrage : jamais bloqué par la limite.
    expect((await register(3)).error).toBeNull();
    await serviceClient()
      .from('device_push_tokens')
      .delete()
      .like('token', `ExponentPushToken[limit-${diaspora.id.slice(0, 8)}-%`);
  });

  it('marque les notifications comme lues pour le seul destinataire', async () => {
    await serviceClient()
      .from('user_notifications')
      .insert({
        user_id: diaspora.id,
        kind: 'test',
        title: 'Test',
        body: 'Notification de test',
        dedup_key: `test:${Date.now()}`,
      });
    const { data: count } = await other.client.rpc('mark_notifications_read');
    expect(count).toBe(0);
    const { data: mine } = await diaspora.client.rpc('mark_notifications_read');
    expect(mine).toBeGreaterThanOrEqual(1);
  });
});
