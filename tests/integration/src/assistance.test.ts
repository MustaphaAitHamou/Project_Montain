import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anonClient, closeDb, createUser, db, deleteCreatedUsers, type TestUser } from './helpers';

/** Espace Entraide : annonces modérées, sans coordonnées personnelles, limitées dans le temps. */
let author: TestUser;
let other: TestUser;
let moderator: TestUser;

beforeAll(async () => {
  author = await createUser('entraide-auteur');
  other = await createUser('entraide-autre');
  moderator = await createUser('entraide-moderateur', ['moderator']);
});

afterAll(async () => {
  await db().query(`delete from public.community_assistance where author_id = any($1::uuid[])`, [
    [author.id, other.id, moderator.id],
  ]);
  await deleteCreatedUsers();
  await closeDb();
});

const post = (user: TestUser, overrides: Record<string, unknown> = {}) =>
  user.client.rpc('create_assistance_post', {
    p_kind: 'offer',
    p_title: 'Couvertures disponibles',
    p_description:
      'Une association du village peut fournir des couvertures aux familles sinistrées.',
    p_commune_code: '1501',
    p_expires_in_days: 7,
    ...overrides,
  });

describe('entraide', () => {
  let postId = '';

  it('crée une annonce en attente, invisible du public avant modération', async () => {
    const { data, error } = await post(author);
    expect(error).toBeNull();
    postId = data as string;
    const mine = await author.client
      .from('community_assistance')
      .select('status')
      .eq('id', postId)
      .single();
    expect(mine.data?.status).toBe('pending');
    const anon = await anonClient().from('community_assistance').select('id').eq('id', postId);
    expect(anon.data).toEqual([]);
    const theirs = await other.client.from('community_assistance').select('id').eq('id', postId);
    expect(theirs.data).toEqual([]);
  });

  it('refuse les coordonnées personnelles et les durées hors limites', async () => {
    const phone = await post(other, {
      p_description: 'Appelez-moi au 0555 12 34 56 pour récupérer les couvertures.',
    });
    expect(phone.error?.message).toContain('personal_contact_not_allowed');
    const duration = await post(other, { p_expires_in_days: 90 });
    expect(duration.error?.message).toContain('invalid_duration');
  });

  it('limite à 3 annonces par 24 heures et par compte', async () => {
    for (let i = 0; i < 3; i += 1) expect((await post(other)).error).toBeNull();
    expect((await post(other)).error?.message).toContain('rate_limited');
  });

  it('réserve la publication à l’équipe, sans auto-modération', async () => {
    const denied = await author.client.rpc('moderate_assistance_post', {
      p_id: postId,
      p_status: 'published',
    });
    expect(denied.error).not.toBeNull();
    const own = await post(moderator);
    const self = await moderator.client.rpc('moderate_assistance_post', {
      p_id: own.data as string,
      p_status: 'published',
    });
    expect(self.error?.message).toContain('self_moderation_forbidden');
    const ok = await moderator.client.rpc('moderate_assistance_post', {
      p_id: postId,
      p_status: 'published',
    });
    expect(ok.error).toBeNull();
    const anon = await anonClient()
      .from('community_assistance')
      .select('id, title')
      .eq('id', postId);
    expect(anon.data).toHaveLength(1);
  });

  it('l’auteur peut clore son annonce, qui disparaît alors du public', async () => {
    await author.client.rpc('close_my_assistance_post', { p_id: postId });
    const anon = await anonClient().from('community_assistance').select('id').eq('id', postId);
    expect(anon.data).toEqual([]);
  });
});
