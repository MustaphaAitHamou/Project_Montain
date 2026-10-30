import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { anonClient, closeDb, config, db, reportParams, serviceClient } from './helpers';

afterAll(closeDb);

interface MailpitMessage {
  ID: string;
  Subject: string;
}

async function waitForEmail(to: string): Promise<string> {
  const base = config().mailpitUrl;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const res = await fetch(`${base}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const body = (await res.json()) as { messages: MailpitMessage[] };
    const message = body.messages[0];
    if (message) {
      const detail = (await (await fetch(`${base}/api/v1/message/${message.ID}`)).json()) as {
        Text: string;
        HTML: string;
      };
      return `${detail.Text}\n${detail.HTML}`;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Aucun e-mail reçu pour ${to}`);
}

describe('inscription avec vérification de l’e-mail (sans numéro de téléphone)', () => {
  const email = `inscription-${randomUUID().slice(0, 8)}@test.tamurt.invalid`;
  const password = 'Montagne2026Djurdjura';
  let userId = '';

  it('refuse la connexion tant que l’e-mail n’est pas confirmé', async () => {
    const client = anonClient();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { display_name: 'Nouvelle Sentinelle', preferred_locale: 'kab' } },
    });
    expect(error).toBeNull();
    expect(data.session).toBeNull();
    userId = data.user?.id ?? '';
    const signIn = await anonClient().auth.signInWithPassword({ email, password });
    expect(signIn.error?.code).toBe('email_not_confirmed');
  });

  it('confirme l’adresse via le lien reçu par e-mail puis crée le profil', async () => {
    const content = (await waitForEmail(email)).replace(/&amp;/g, '&');
    // Le modèle d'e-mail pointe vers la route /auth/confirm du site (flux SSR).
    const link = content.match(/https?:\/\/[^\s"<>]+\/auth\/confirm\?[^\s"<>]+/)?.[0];
    expect(link).toBeTruthy();
    const url = new URL(link as string);
    expect(url.searchParams.get('type')).toBe('email');
    const tokenHash = url.searchParams.get('token_hash');
    expect(tokenHash).toBeTruthy();

    // Ce que fait la route /auth/confirm : vérification du jeton à usage unique.
    const verifier = anonClient();
    const verified = await verifier.auth.verifyOtp({
      token_hash: tokenHash as string,
      type: 'email',
    });
    expect(verified.error).toBeNull();
    const replay = await anonClient().auth.verifyOtp({
      token_hash: tokenHash as string,
      type: 'email',
    });
    expect(replay.error).not.toBeNull();

    const client = anonClient();
    const signIn = await client.auth.signInWithPassword({ email, password });
    expect(signIn.error).toBeNull();
    const { data: profile } = await client
      .from('profiles')
      .select('display_name, preferred_locale, reputation')
      .single();
    expect(profile).toEqual({
      display_name: 'Nouvelle Sentinelle',
      preferred_locale: 'kab',
      reputation: 0,
    });

    // Export des données personnelles (droit d'accès).
    const { data: exported } = await client.rpc('export_my_data');
    expect(exported.account.email).toBe(email);
    expect(exported.profile.display_name).toBe('Nouvelle Sentinelle');

    // Un signalement pour vérifier l'anonymisation à la suppression du compte.
    const report = await client.rpc('submit_report', reportParams());
    expect(report.error).toBeNull();
  });

  it('supprime le compte et anonymise ses signalements', async () => {
    const { error } = await serviceClient().auth.admin.deleteUser(userId);
    expect(error).toBeNull();
    const { rows: profiles } = await db().query(`select 1 from public.profiles where id = $1`, [
      userId,
    ]);
    expect(profiles).toHaveLength(0);
    const { rows: reports } = await db().query(
      `select count(*)::int as n from public.alert_reports where author_id = $1`,
      [userId],
    );
    expect(reports[0].n).toBe(0);
  });
});
