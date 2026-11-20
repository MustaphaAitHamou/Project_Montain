import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ALGER,
  TAMANRASSET,
  TUNIS,
  anonClient,
  closeDb,
  createUser,
  db,
  deleteCreatedUsers,
  reportParams,
  type TestUser,
} from './helpers';

let alice: TestUser;
let bob: TestUser;
// Compte dédié aux photos : la limite serveur est de 5 signalements par heure et par compte.
let dave: TestUser;

beforeAll(async () => {
  alice = await createUser('alice');
  bob = await createUser('bob');
  dave = await createUser('dave');
});

afterAll(async () => {
  await deleteCreatedUsers();
  await closeDb();
});

describe('soumission de signalement', () => {
  it('enregistre un signalement « en attente » rattaché à la commune', async () => {
    const { data, error } = await alice.client.rpc('submit_report', reportParams());
    expect(error).toBeNull();
    expect(data).toMatchObject({ status: 'pending', idempotent: false, commune_code: '1501' });
    const { rows } = await db().query(
      `select moderation_status, event_id, location_uncertainty_m, author_id from public.alert_reports where id = $1`,
      [data.report_id],
    );
    expect(rows[0]).toMatchObject({
      moderation_status: 'pending',
      event_id: null,
      location_uncertainty_m: 500,
      author_id: alice.id,
    });
  });

  it('couvre tout le territoire national, du Nord au Grand Sud', async () => {
    // Compte dédié : la limite serveur est de 5 signalements par heure et par compte.
    const erin = await createUser('erin');
    const north = await erin.client.rpc(
      'submit_report',
      reportParams({ p_lat: ALGER.lat, p_lng: ALGER.lng }),
    );
    expect(north.error).toBeNull();
    expect(north.data.commune_code).toMatch(/^16\d{2}$/);
    const south = await erin.client.rpc(
      'submit_report',
      reportParams({ p_lat: TAMANRASSET.lat, p_lng: TAMANRASSET.lng }),
    );
    expect(south.error).toBeNull();
    expect(south.data.commune_code).toBe('1101');
  });

  it('est idempotent pour un même identifiant client (file hors ligne)', async () => {
    const params = reportParams();
    const first = await alice.client.rpc('submit_report', params);
    const second = await alice.client.rpc('submit_report', params);
    expect(second.data).toMatchObject({ report_id: first.data.report_id, idempotent: true });
  });

  it.each([
    [{ p_lat: TUNIS.lat, p_lng: TUNIS.lng }, 'outside_coverage'],
    [{ p_subcategory_id: 'fire.confirmed' }, 'subcategory_invalid'],
    [
      { p_category_id: 'mutual_aid', p_subcategory_id: 'mutual_aid.logistics' },
      'category_not_reportable',
    ],
    [{ p_description: 'Contactez-moi au 0555 12 34 56 pour info' }, 'personal_contact_not_allowed'],
    [{ p_observed_at: new Date(Date.now() + 3600_000).toISOString() }, 'observed_in_future'],
    [{ p_observed_at: new Date(Date.now() - 48 * 3600_000).toISOString() }, 'observed_too_old'],
    [
      {
        p_category_id: 'traffic',
        p_subcategory_id: 'traffic.road_closed',
        p_location_precision: 'uncertain',
      },
      'location_must_be_precise',
    ],
    [{ p_description: 'feu' }, 'description_too_short'],
  ])('refuse côté serveur : %j → %s', async (overrides, code) => {
    const { error } = await bob.client.rpc('submit_report', reportParams(overrides));
    expect(error?.message).toContain(code);
  });

  it('refuse un visiteur non connecté', async () => {
    const { error } = await anonClient().rpc('submit_report', reportParams());
    expect(error).not.toBeNull();
  });

  it('isole les signalements entre utilisateurs (RLS)', async () => {
    const { data } = await alice.client.rpc('submit_report', reportParams());
    const asBob = await bob.client.from('alert_reports').select('id').eq('id', data.report_id);
    expect(asBob.data).toEqual([]);
    const asAlice = await alice.client.from('alert_reports').select('id').eq('id', data.report_id);
    expect(asAlice.data).toHaveLength(1);
  });

  it('interdit toute écriture directe dans la table des signalements', async () => {
    const { error } = await alice.client.from('alert_reports').insert({
      client_id: crypto.randomUUID(),
      category_id: 'fire',
      subcategory_id: 'fire.smoke',
      description: 'insertion directe',
      location: 'SRID=4326;POINT(4.05 36.71)',
      location_precision: 'exact',
      location_uncertainty_m: 10,
      observed_at: new Date().toISOString(),
      moderation_status: 'approved',
    });
    expect(error?.code).toBe('42501');
  });

  it('permet le retrait d’un signalement en attente par son auteur uniquement', async () => {
    const { data } = await alice.client.rpc('submit_report', reportParams());
    const byBob = await bob.client.rpc('withdraw_report', { p_report_id: data.report_id });
    expect(byBob.error?.message).toContain('not_found');
    const byAlice = await alice.client.rpc('withdraw_report', { p_report_id: data.report_id });
    expect(byAlice.error).toBeNull();
    const again = await alice.client.rpc('withdraw_report', { p_report_id: data.report_id });
    expect(again.error?.message).toContain('report_not_pending');
  });

  it('limite le nombre de signalements par heure', async () => {
    const carol = await createUser('carol');
    const results = [];
    for (let i = 0; i < 6; i += 1) {
      results.push(await carol.client.rpc('submit_report', reportParams()));
    }
    expect(results.slice(0, 5).every((r) => r.error === null)).toBe(true);
    expect(results[5]?.error?.message).toContain('rate_limited');
  });
});

describe('photos en quarantaine (Storage)', () => {
  it('autorise le dépôt dans le dossier de son propre signalement uniquement', async () => {
    const { data } = await dave.client.rpc('submit_report', reportParams());
    const reportId = data.report_id as string;
    // Vraie image JPEG générée à la volée (2×2 px).
    const jpeg = await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#d84315' },
    })
      .jpeg()
      .toBuffer();
    const ownPath = `${dave.id}/${reportId}/photo.jpg`;
    const upload = await dave.client.storage
      .from('report-media-quarantine')
      .upload(ownPath, jpeg, { contentType: 'image/jpeg' });
    expect(upload.error).toBeNull();

    const foreign = await bob.client.storage
      .from('report-media-quarantine')
      .upload(`${dave.id}/${reportId}/intrus.jpg`, jpeg, { contentType: 'image/jpeg' });
    expect(foreign.error).not.toBeNull();

    const registered = await dave.client.rpc('register_report_media', {
      p_report_id: reportId,
      p_path: ownPath,
    });
    expect(registered.error).toBeNull();

    // Un tiers ne peut ni lire le fichier en quarantaine ni la ligne de média.
    const read = await bob.client.storage.from('report-media-quarantine').download(ownPath);
    expect(read.error).not.toBeNull();
    const row = await bob.client.from('alert_media').select('id').eq('report_id', reportId);
    expect(row.data).toEqual([]);
  });

  it('refuse les types non autorisés', async () => {
    const { data } = await dave.client.rpc('submit_report', reportParams());
    const upload = await dave.client.storage
      .from('report-media-quarantine')
      .upload(`${dave.id}/${data.report_id}/script.svg`, Buffer.from('<svg/>'), {
        contentType: 'image/svg+xml',
      });
    expect(upload.error).not.toBeNull();
  });
});
