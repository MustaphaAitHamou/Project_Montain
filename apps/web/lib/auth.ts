import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { AppRole } from '@tamurt/shared';
import { createSupabaseServerClient, type ServerSupabase } from '@/lib/supabase/server';
import { getServerEnv } from '@/lib/env.server';

export interface SessionUser {
  id: string;
  email: string | null;
  roles: AppRole[];
  aal: 'aal1' | 'aal2' | null;
  displayName: string | null;
  preferredLocale: string | null;
  isSuspended: boolean;
}

export interface SessionContext {
  supabase: ServerSupabase | null;
  user: SessionUser | null;
  backend: 'not_configured' | 'ok' | 'unreachable';
}

/**
 * Identité vérifiée de l'appelant (JWT validé par getClaims) + rôles lus en base.
 * Mis en cache pour la durée d'une requête.
 */
export const getSession = cache(async (): Promise<SessionContext> => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { supabase: null, user: null, backend: 'not_configured' };
  try {
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims?.sub) return { supabase, user: null, backend: 'ok' };
    const claims = data.claims as Record<string, unknown>;
    const userId = String(claims.sub);
    const [{ data: roles }, { data: profile }] = await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', userId),
      supabase
        .from('profiles')
        .select('display_name, preferred_locale, is_suspended')
        .eq('id', userId)
        .maybeSingle(),
    ]);
    return {
      supabase,
      backend: 'ok',
      user: {
        id: userId,
        email: typeof claims.email === 'string' ? claims.email : null,
        roles: (roles ?? []).map((r) => r.role as AppRole),
        aal: claims.aal === 'aal2' ? 'aal2' : claims.aal === 'aal1' ? 'aal1' : null,
        displayName: profile?.display_name ?? null,
        preferredLocale: profile?.preferred_locale ?? null,
        isSuspended: profile?.is_suspended ?? false,
      },
    };
  } catch {
    return { supabase, user: null, backend: 'unreachable' };
  }
});

export async function requireUser(
  nextPath: string,
): Promise<SessionContext & { user: SessionUser }> {
  const session = await getSession();
  if (!session.user) redirect(`/connexion?next=${encodeURIComponent(nextPath)}`);
  return session as SessionContext & { user: SessionUser };
}

export function isStaff(user: SessionUser | null): boolean {
  return Boolean(user && (user.roles.includes('moderator') || user.roles.includes('admin')));
}

export function isAdmin(user: SessionUser | null): boolean {
  return Boolean(user?.roles.includes('admin'));
}

/** Le MFA (aal2) est-il requis et satisfait pour les opérations d'administration ? */
export function adminMfaSatisfied(user: SessionUser): boolean {
  return !getServerEnv().requireAdminMfa || user.aal === 'aal2';
}

/** N'autorise que les chemins internes (évite les redirections ouvertes). */
export function safeNextPath(value: string | null | undefined, fallback = '/'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return fallback;
  }
  return value;
}
