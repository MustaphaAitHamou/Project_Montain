// Outils communs aux scripts de démonstration. Aucune dépendance : fetch natif (Node ≥ 22).
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');

/**
 * Cible : variables SUPABASE_URL + SUPABASE_SECRET_KEY, sinon la pile locale (`supabase status`).
 * Par sécurité, seule une instance LOCALE est acceptée, sauf si l'hôte d'une instance de
 * démonstration dédiée est confirmé explicitement : --remote-demo-host=<hôte exact>.
 */
export function resolveTarget(argv = process.argv.slice(2)) {
  let url = process.env.SUPABASE_URL;
  let key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    const raw = execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const status = JSON.parse(raw.slice(raw.indexOf('{')));
    url = status.API_URL;
    key = status.SECRET_KEY;
  }
  if (!url || !key)
    throw new Error('Configuration Supabase introuvable (SUPABASE_URL / SUPABASE_SECRET_KEY).');
  const host = new URL(url).hostname;
  const local = host === '127.0.0.1' || host === 'localhost';
  const confirmed = argv.find((a) => a.startsWith('--remote-demo-host='))?.split('=')[1];
  if (!local && confirmed !== host) {
    throw new Error(
      `Refus : ${host} n'est pas une instance locale. Les données DÉMO ne doivent jamais aller en production. ` +
        `Pour une instance de démonstration DÉDIÉE uniquement : --remote-demo-host=${host}`,
    );
  }
  return { url: url.replace(/\/$/, ''), key, host };
}

export async function rest(target, path, { method = 'GET', body, prefer } = {}) {
  const res = await fetch(`${target.url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: target.key,
      Authorization: `Bearer ${target.key}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → HTTP ${res.status} : ${text}`);
  return text ? JSON.parse(text) : null;
}

export async function setDemoMode(target, enabled) {
  await rest(target, 'app_settings?key=eq.demo_mode', {
    method: 'PATCH',
    body: { value: enabled },
  });
}
