'use server';

import { redirect } from 'next/navigation';
import {
  authErrorKey,
  newPasswordSchema,
  passwordResetRequestSchema,
  signInSchema,
  signUpSchema,
} from '@tamurt/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getPublicEnv } from '@/lib/env';
import { getLocale } from '@/lib/i18n';
import { safeNextPath } from '@/lib/auth';

export interface AuthState {
  ok?: boolean;
  /** Clé de traduction du message à afficher. */
  messageKey?: string;
  fieldErrors?: Record<string, string>;
}

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? 'form');
    out[key] ??= issue.message;
  }
  return out;
}

export async function signInAction(
  _prev: AuthState | null,
  formData: FormData,
): Promise<AuthState> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { messageKey: 'connectivity.notConfigured' };
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { messageKey: authErrorKey(error.code, error.status) };
  redirect(safeNextPath(String(formData.get('next') ?? '/')));
}

export async function signUpAction(
  _prev: AuthState | null,
  formData: FormData,
): Promise<AuthState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    displayName: formData.get('displayName') || undefined,
    acceptTerms: formData.get('acceptTerms') === 'on',
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { messageKey: 'connectivity.notConfigured' };
  const locale = await getLocale();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${getPublicEnv().siteUrl}/auth/confirm`,
      data: { display_name: parsed.data.displayName, preferred_locale: locale },
    },
  });
  if (error) return { messageKey: authErrorKey(error.code, error.status) };
  // Message identique que l'adresse soit déjà connue ou non (pas d'énumération des comptes).
  return { ok: true, messageKey: 'auth.checkEmail' };
}

export async function forgotPasswordAction(
  _prev: AuthState | null,
  formData: FormData,
): Promise<AuthState> {
  const parsed = passwordResetRequestSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { messageKey: 'connectivity.notConfigured' };
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getPublicEnv().siteUrl}/reinitialiser-mot-de-passe`,
  });
  if (error && error.status === 429) return { messageKey: 'auth.rateLimited' };
  return { ok: true, messageKey: 'auth.resetSent' };
}

export async function resetPasswordAction(
  _prev: AuthState | null,
  formData: FormData,
): Promise<AuthState> {
  const parsed = newPasswordSchema.safeParse({
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { messageKey: 'connectivity.notConfigured' };
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { messageKey: 'auth.linkInvalid' };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { messageKey: authErrorKey(error.code, error.status) };
  return { ok: true, messageKey: 'auth.passwordUpdated' };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  // Révocation de la session courante côté serveur (jeton de rafraîchissement invalidé).
  await supabase?.auth.signOut({ scope: 'local' });
  redirect('/');
}

export async function signOutEverywhereAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase?.auth.signOut({ scope: 'global' });
  redirect('/connexion');
}
