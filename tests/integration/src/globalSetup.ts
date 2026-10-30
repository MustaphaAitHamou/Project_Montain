import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { TestProject } from 'vitest/node';

export interface LocalSupabaseConfig {
  apiUrl: string;
  dbUrl: string;
  publishableKey: string;
  secretKey: string;
  mailpitUrl: string;
}

declare module 'vitest' {
  export interface ProvidedContext {
    supabase: LocalSupabaseConfig;
  }
}

/**
 * Lit la configuration de la pile Supabase locale (`supabase status`).
 * Les variables d'environnement SUPABASE_* permettent de cibler une autre instance de test.
 * Ces tests ne doivent JAMAIS viser une base de production.
 */
export default function setup(project: TestProject) {
  let status: Record<string, string> = {};
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    const repoRoot = resolve(import.meta.dirname, '..', '..', '..');
    const raw = execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    status = JSON.parse(raw.slice(raw.indexOf('{'))) as Record<string, string>;
  }
  const config: LocalSupabaseConfig = {
    apiUrl: process.env.SUPABASE_URL ?? status.API_URL ?? '',
    dbUrl: process.env.SUPABASE_DB_URL ?? status.DB_URL ?? '',
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY ?? status.PUBLISHABLE_KEY ?? '',
    secretKey: process.env.SUPABASE_SECRET_KEY ?? status.SECRET_KEY ?? '',
    mailpitUrl: process.env.MAILPIT_URL ?? status.MAILPIT_URL ?? 'http://127.0.0.1:54324',
  };
  for (const [key, value] of Object.entries(config)) {
    if (!value) throw new Error(`Configuration Supabase locale incomplète : ${key}`);
  }
  if (
    !/127\.0\.0\.1|localhost/.test(config.apiUrl) &&
    process.env.ALLOW_REMOTE_TEST_DB !== 'true'
  ) {
    throw new Error('Refus : les tests d’intégration ne ciblent que une instance locale.');
  }
  project.provide('supabase', config);
}
