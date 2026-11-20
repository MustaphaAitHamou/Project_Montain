import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  moderateMedia,
  processOutbox,
  runSourceSync,
  sendTestNotification,
  type ExpoProvider,
  type Providers,
  type PushMessage,
  type ServiceClient,
} from '@tamurt/server';
import {
  anonClient,
  closeDb,
  createUser,
  db,
  deleteCreatedUsers,
  reportParams,
  serviceClient,
  type TestUser,
} from './helpers';

/** Fournisseur Expo factice : capture les messages, peut simuler un jeton invalide. */
function fakeExpo(invalidTokens: Set<string> = new Set()) {
  const sent: { token: string; message: PushMessage }[] = [];
  const provider: ExpoProvider = {
    async send(tokens, message) {
      return tokens.map((token) => {
        sent.push({ token, message });
        return invalidTokens.has(token)
          ? { ok: false as const, invalidToken: true, error: 'DeviceNotRegistered: test' }
          : { ok: true as const, ticketId: `ticket-${sent.length}` };
      });
    },
    async receipts() {
      return {};
    },
  };
  return { provider, sent };
}

let service: ServiceClient;
let follower: TestUser;
let reporter: TestUser;
let moderator: TestUser;

beforeAll(async () => {
  service = serviceClient() as unknown as ServiceClient;
  follower = await createUser('abonne');
  reporter = await createUser('signaleur');
  moderator = await createUser('modo-push', ['moderator']);
  await follower.client.from('user_followed_places').insert({
    user_id: follower.id,
    label: 'Mon village (test)',
    place_type: 'commune',
    commune_code: '1501',
    location: 'SRID=4326;POINT(0 0)',
    radius_m: 3000,
  });
  await follower.client.rpc('register_push_token', {
    p_kind: 'expo',
    p_platform: 'android',
    p_token: `ExponentPushToken[abonne-${follower.id.slice(0, 8)}]`,
  });
  // Les outbox laissées par d'autres fichiers de test sont marquées traitées pour isoler ce test.
  await db().query(`update public.notification_outbox set status = 'done' where status <> 'done'`);
});

afterAll(async () => {
  await db().query(
    `update public.alert_sources set enabled = false, consecutive_failures = 0, circuit_open_until = null where id = 'emsc'`,
  );
  await deleteCreatedUsers();
  await closeDb();
});

describe('moteur de notifications (outbox → destinataires → push)', () => {
  it('respecte les préférences, notifie la confirmation et déduplique', async () => {
    const { data } = await reporter.client.rpc('submit_report', reportParams());
    const { data: eventId } = await moderator.client.rpc('moderate_approve_report', {
      p_report_id: data.report_id,
      p_mode: 'new_event',
      p_event_id: null,
      p_status: 'under_review',
      p_severity: 'vigilance',
    });
    const expo = fakeExpo();
    const providers: Providers = { expo: expo.provider, webpush: null };

    // Publication « en vérification » : l'abonné n'accepte pas le non vérifié → aucune notification.
    const first = await processOutbox(service, providers);
    expect(first.processed).toBeGreaterThanOrEqual(1);
    expect(expo.sent).toHaveLength(0);
    const inbox0 = await follower.client
      .from('user_notifications')
      .select('id')
      .eq('event_id', eventId);
    expect(inbox0.data).toEqual([]);

    // Confirmation par l'équipe → notification push.
    await moderator.client.rpc('moderate_update_event', {
      p_event_id: eventId,
      p_status: 'confirmed',
      p_severity: 'important',
      p_reason: 'Confirmation test',
    });
    const second = await processOutbox(service, providers);
    expect(second.recipients).toBe(1);
    expect(expo.sent).toHaveLength(1);
    expect(expo.sent[0]?.message.title).toContain('Fumée signalée');
    expect(expo.sent[0]?.message.data.eventId).toBe(eventId);

    const { data: inbox } = await follower.client
      .from('user_notifications')
      .select('id, channel, reason')
      .eq('event_id', eventId);
    expect(inbox).toEqual([
      expect.objectContaining({ channel: 'push', reason: 'status_upgraded' }),
    ]);
    const { rows: deliveries } = await db().query(
      `select status, provider_ticket_id from public.notification_deliveries where notification_id = $1`,
      [inbox?.[0]?.id],
    );
    expect(deliveries).toEqual([expect.objectContaining({ status: 'sent' })]);

    // Rejouer l'outbox ne renvoie rien (déduplication).
    await db().query(
      `update public.notification_outbox set status = 'pending', attempts = 0 where event_id = $1`,
      [eventId],
    );
    await processOutbox(service, providers);
    expect(expo.sent).toHaveLength(1);
  });

  it('désactive un jeton signalé invalide par le fournisseur', async () => {
    const token = `ExponentPushToken[abonne-${follower.id.slice(0, 8)}]`;
    const expo = fakeExpo(new Set([token]));
    const result = await sendTestNotification(
      service,
      { expo: expo.provider, webpush: null },
      follower.id,
      {
        title: 'Notification de test',
        body: 'Test',
      },
    );
    expect(result).toMatchObject({ created: true, failed: 1 });
    const { rows } = await db().query(
      `select enabled from public.device_push_tokens where token = $1`,
      [token],
    );
    expect(rows[0]?.enabled).toBe(false);
  });
});

describe('synchronisation des sources externes (réponses simulées)', () => {
  // Échantillon SYNTHÉTIQUE au format FDSN texte — aucun événement réel.
  const farQuakeId = `ITEST_FAR_${Date.now()}`;
  const syntheticFdsn = [
    '#EventID|Time|Latitude|Longitude|Depth/km|Author|Catalog|Contributor|ContributorID|MagType|Magnitude|MagAuthor|EventLocationName',
    `ITEST_${Date.now()}|2026-10-30T08:00:00|36.72|4.06|9.0|EMSC|EMSC|EMSC|X|ml|3.6|EMSC|SYNTHETIC TEST`,
    `ITEST_SMALL_${Date.now()}|2026-10-30T07:00:00|36.70|4.10|5.0|EMSC|EMSC|EMSC|X|ml|2.6|EMSC|SYNTHETIC TEST`,
    // Épicentre fictif à environ 150 km de la frontière (nord du Maroc) : observation, pas d'événement.
    `${farQuakeId}|2026-10-30T06:00:00|35.25|-3.93|10.0|EMSC|EMSC|EMSC|X|ml|3.8|EMSC|SYNTHETIC FAR`,
  ].join('\n');

  it('ignore une source désactivée et une source sans clé', async () => {
    await db().query(`update public.alert_sources set enabled = false where id = 'emsc'`);
    expect(
      await runSourceSync(service, 'emsc', {
        secrets: { nasaFirmsMapKey: null, openMeteoApiKey: null },
      }),
    ).toEqual({
      status: 'skipped',
      reason: 'disabled',
    });
    await db().query(`update public.alert_sources set enabled = true where id = 'nasa_firms'`);
    try {
      expect(
        await runSourceSync(service, 'nasa_firms', {
          secrets: { nasaFirmsMapKey: null, openMeteoApiKey: null },
        }),
      ).toEqual({ status: 'skipped', reason: 'missing_key' });
    } finally {
      await db().query(`update public.alert_sources set enabled = false where id = 'nasa_firms'`);
    }
  });

  it('enregistre les observations, crée un événement sismique au-dessus du seuil et journalise', async () => {
    await db().query(
      `update public.alert_sources set enabled = true, consecutive_failures = 0 where id = 'emsc'`,
    );
    const fetchImpl = async () => new Response(syntheticFdsn, { status: 200 });
    const outcome = await runSourceSync(service, 'emsc', {
      secrets: { nasaFirmsMapKey: null, openMeteoApiKey: null },
      fetchImpl,
      trigger: 'test',
    });
    expect(outcome).toMatchObject({ status: 'success', fetched: 3, eventsCreated: 1 });
    const { rows: far } = await db().query(
      `select (select count(*)::int from public.external_observations
                where source_id = 'emsc' and external_id = $1) as observations,
              (select count(*)::int from public.alert_events
                where external_source_id = 'emsc' and external_ref = $1) as events`,
      [farQuakeId],
    );
    expect(far[0]).toMatchObject({ observations: 1, events: 0 });
    const { rows: events } = await db().query(
      `select status, severity, source_kind, commune_code, magnitude from public.alert_events
       where external_source_id = 'emsc' and external_ref like 'ITEST_%' order by created_at desc limit 1`,
    );
    expect(events[0]).toMatchObject({
      status: 'confirmed',
      severity: 'vigilance',
      source_kind: 'seismic',
      commune_code: '1501',
    });
    // Une seconde exécution ne duplique rien.
    const again = await runSourceSync(service, 'emsc', {
      secrets: { nasaFirmsMapKey: null, openMeteoApiKey: null },
      fetchImpl,
      trigger: 'test',
    });
    expect(again).toMatchObject({ status: 'success', eventsCreated: 0 });
    const { rows: runs } = await db().query(
      `select status from public.api_sync_runs where source_id = 'emsc' order by id desc limit 2`,
    );
    expect(runs.map((r) => r.status)).toEqual(['success', 'success']);
  });

  it('enregistre l’échec, incrémente le compteur et ne fabrique aucune donnée', async () => {
    const before = await db().query(
      `select count(*)::int as n from public.external_observations where source_id = 'emsc'`,
    );
    const outcome = await runSourceSync(service, 'emsc', {
      secrets: { nasaFirmsMapKey: null, openMeteoApiKey: null },
      fetchImpl: async () => new Response('Service Unavailable', { status: 503 }),
      trigger: 'test',
    });
    expect(outcome).toMatchObject({ status: 'failed', consecutiveFailures: 1 });
    const after = await db().query(
      `select count(*)::int as n from public.external_observations where source_id = 'emsc'`,
    );
    expect(after.rows[0].n).toBe(before.rows[0].n);
    const { rows } = await db().query(
      `select last_error from public.alert_sources where id = 'emsc'`,
    );
    expect(rows[0].last_error).toContain('503');
  });
});

describe('publication d’une photo modérée', () => {
  it('ré-encode sans EXIF, publie et supprime l’original', async () => {
    const { data } = await reporter.client.rpc('submit_report', reportParams());
    const reportId = data.report_id as string;
    const jpeg = await sharp({
      create: { width: 640, height: 480, channels: 3, background: '#d84315' },
    })
      .jpeg()
      .withExif({ IFD0: { Make: 'Telephone', Model: 'GPS-Inside' } })
      .toBuffer();
    const path = `${reporter.id}/${reportId}/photo.jpg`;
    const upload = await reporter.client.storage
      .from('report-media-quarantine')
      .upload(path, jpeg, {
        contentType: 'image/jpeg',
      });
    expect(upload.error).toBeNull();
    const { data: mediaId } = await reporter.client.rpc('register_report_media', {
      p_report_id: reportId,
      p_path: path,
    });
    await moderator.client.rpc('moderate_approve_report', {
      p_report_id: reportId,
      p_mode: 'new_event',
      p_event_id: null,
      p_status: 'under_review',
      p_severity: 'vigilance',
    });

    const result = await moderateMedia(service, mediaId as string, true, moderator.id);
    expect(result.status).toBe('approved');

    // Visible publiquement (visiteur), sans métadonnées.
    const { data: rows } = await anonClient()
      .from('alert_media')
      .select('public_path, exif_stripped')
      .eq('id', mediaId);
    expect(rows?.[0]).toMatchObject({ exif_stripped: true });
    const publicFile = await anonClient()
      .storage.from('report-media-public')
      .download(result.publicPath as string);
    expect(publicFile.error).toBeNull();
    const meta = await sharp(Buffer.from(await (publicFile.data as Blob).arrayBuffer())).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.exif).toBeUndefined();

    // L'original en quarantaine n'existe plus.
    const original = await service.storage.from('report-media-quarantine').download(path);
    expect(original.error).not.toBeNull();
  });
});
