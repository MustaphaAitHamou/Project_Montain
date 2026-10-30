import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPublicEnv, isSupabaseConfigured } from './env';

describe('configuration publique', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('considère le backend non configuré sans URL ni clé', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '   ');
    expect(isSupabaseConfigured(getPublicEnv())).toBe(false);
  });

  it('active le mode démo uniquement sur la valeur explicite « true »', () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'TRUE');
    expect(getPublicEnv().demoMode).toBe(false);
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'true');
    expect(getPublicEnv().demoMode).toBe(true);
  });

  it('détecte une configuration complète', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
    expect(isSupabaseConfigured(getPublicEnv())).toBe(true);
  });
});
