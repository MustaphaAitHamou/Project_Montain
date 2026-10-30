import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

/** Lit apps/web/.env.local (ou l'environnement) pour accéder à la pile Supabase LOCALE. */
function env(name: string): string {
  if (process.env[name]) return process.env[name] as string;
  try {
    const raw = readFileSync(join(import.meta.dirname, '..', '.env.local'), 'utf8');
    const line = raw.split('\n').find((l) => l.startsWith(`${name}=`));
    if (line) return line.slice(name.length + 1).trim();
  } catch {
    // pas de fichier : variable absente
  }
  throw new Error(`Variable ${name} manquante pour les tests e2e`);
}

export const SUPABASE_URL = () => env('NEXT_PUBLIC_SUPABASE_URL');
export const MAILPIT_URL = () => process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';

export function serviceClient() {
  const url = SUPABASE_URL();
  if (!/127\.0\.0\.1|localhost/.test(url))
    throw new Error('Les tests e2e ne ciblent qu’une instance locale.');
  return createClient(url, env('SUPABASE_SECRET_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function uniqueEmail(label: string) {
  return `${label}-${randomUUID().slice(0, 8)}@e2e.tamurt.invalid`;
}

export async function createConfirmedUser(label: string, roles: string[] = []) {
  const admin = serviceClient();
  const email = uniqueEmail(label);
  const password = `Djurdjura${Math.floor(Math.random() * 1e6)}x`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error('createUser');
  for (const role of roles) {
    await admin.from('user_roles').insert({ user_id: data.user.id, role, reason: 'e2e' });
  }
  return { id: data.user.id, email, password };
}

export async function deleteUser(id: string) {
  const service = serviceClient();
  // Signalements de test encore en attente : retirés pour ne pas encombrer la file de modération.
  await service
    .from('alert_reports')
    .update({ moderation_status: 'withdrawn', withdrawn_at: new Date().toISOString() })
    .eq('author_id', id)
    .eq('moderation_status', 'pending');
  await service.auth.admin.deleteUser(id);
}

export async function waitForConfirmationLink(email: string): Promise<string> {
  for (let i = 0; i < 30; i += 1) {
    const res = await fetch(
      `${MAILPIT_URL()}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
    );
    const body = (await res.json()) as { messages: { ID: string }[] };
    const id = body.messages[0]?.ID;
    if (id) {
      const msg = (await (await fetch(`${MAILPIT_URL()}/api/v1/message/${id}`)).json()) as {
        HTML: string;
        Text: string;
      };
      const content = `${msg.Text}\n${msg.HTML}`.replace(/&amp;/g, '&');
      const link = content.match(/https?:\/\/[^\s"<>]+\/auth\/confirm\?[^\s"<>]+/)?.[0];
      if (link) return link;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Pas d’e-mail pour ${email}`);
}

export async function signIn(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
  next = '/',
) {
  await page.goto(`/connexion?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}
