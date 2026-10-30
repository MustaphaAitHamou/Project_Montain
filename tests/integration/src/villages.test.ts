import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anonClient, closeDb, createUser, db, deleteCreatedUsers, type TestUser } from './helpers';

/**
 * Proposition d'un village par un utilisateur → revue par la modération → visible de tous.
 * Une proposition en attente n'est visible que de son auteur et de l'équipe.
 */
let author: TestUser;
let other: TestUser;
let moderator: TestUser;
const name = `Thaddart Essai ${Math.random().toString(36).slice(2, 7)}`;
// Point situé dans la commune de Tizi Ouzou.
const point = { lat: 36.7118, lng: 4.0459 };

beforeAll(async () => {
  author = await createUser('village-auteur');
  other = await createUser('village-autre');
  moderator = await createUser('village-moderateur', ['moderator']);
});

afterAll(async () => {
  await db().query(`delete from public.villages where name_fr = $1`, [name]);
  await deleteCreatedUsers();
  await closeDb();
});

describe('proposition de villages', () => {
  let villageId = '';

  it('enregistre la proposition en attente, rattachée à la commune', async () => {
    const { data, error } = await author.client.rpc('propose_village', {
      p_name: name,
      p_lat: point.lat,
      p_lng: point.lng,
    });
    expect(error).toBeNull();
    villageId = data as string;
    const { rows } = await db().query(
      `select status, source, commune_code from public.villages where id = $1`,
      [villageId],
    );
    expect(rows[0]).toMatchObject({ status: 'pending_review', source: 'community' });
    expect(rows[0].commune_code).toMatch(/^\d{4}$/);
  });

  it('reste invisible des autres utilisateurs et de la recherche tant qu’elle n’est pas validée', async () => {
    const mine = await author.client.from('villages').select('id').eq('id', villageId);
    expect(mine.data).toHaveLength(1);
    const theirs = await other.client.from('villages').select('id').eq('id', villageId);
    expect(theirs.data).toEqual([]);
    const search = await anonClient().rpc('search_places', { q: name, max_results: 10 });
    expect((search.data ?? []).some((r: { id: string }) => r.id === villageId)).toBe(false);
  });

  it('refuse les noms contenant des coordonnées personnelles et les lieux hors zone', async () => {
    const phone = await author.client.rpc('propose_village', {
      p_name: 'Appelez le 0555123456',
      p_lat: point.lat,
      p_lng: point.lng,
    });
    expect(phone.error?.message).toContain('invalid_name');
    const outside = await author.client.rpc('propose_village', {
      p_name: 'Village lointain',
      p_lat: 48.85,
      p_lng: 2.35,
    });
    expect(outside.error?.message).toContain('outside_coverage');
  });

  it('seule l’équipe de modération peut valider ; le village devient alors cherchable', async () => {
    const denied = await other.client.rpc('review_village', {
      p_village_id: villageId,
      p_approve: true,
    });
    expect(denied.error).not.toBeNull();
    const approved = await moderator.client.rpc('review_village', {
      p_village_id: villageId,
      p_approve: true,
    });
    expect(approved.error).toBeNull();
    const search = await anonClient().rpc('search_places', { q: name, max_results: 10 });
    const found = (search.data ?? []).find((r: { id: string }) => r.id === villageId) as
      { kind: string } | undefined;
    expect(found?.kind).toBe('village');
    const { rows } = await db().query(
      `select action from public.audit_logs where target_id = $1 order by created_at`,
      [villageId],
    );
    expect(rows.map((r) => r.action)).toEqual(['village.proposed', 'village.reviewed']);
  });
});
