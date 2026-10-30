'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { notificationPreferencesSchema, profileUpdateSchema } from '@tamurt/shared';
import { getSession } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/admin';
import { getPublicEnv } from '@/lib/env';
import { rpcErrorCode } from '@/lib/errors';

export interface FormResult {
  ok: boolean;
  messageKey?: string;
}

export async function updateProfileAction(
  _prev: FormResult | null,
  formData: FormData,
): Promise<FormResult> {
  const { supabase, user } = await getSession();
  if (!supabase || !user) return { ok: false, messageKey: 'common.signInRequired' };
  const parsed = profileUpdateSchema.safeParse({
    displayName: (formData.get('displayName') as string | null)?.trim() || null,
    preferredLocale: formData.get('preferredLocale'),
  });
  if (!parsed.success) return { ok: false, messageKey: 'common.errorGeneric' };
  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: parsed.data.displayName,
      preferred_locale: parsed.data.preferredLocale,
    })
    .eq('id', user.id);
  if (error) return { ok: false, messageKey: 'common.errorGeneric' };
  revalidatePath('/profil');
  return { ok: true, messageKey: 'common.saved' };
}

export async function updateNotificationPreferencesAction(
  _prev: FormResult | null,
  formData: FormData,
): Promise<FormResult> {
  const { supabase, user } = await getSession();
  if (!supabase || !user) return { ok: false, messageKey: 'common.signInRequired' };
  const parsed = notificationPreferencesSchema.safeParse({
    pushEnabled: formData.get('pushEnabled') === 'on',
    webPushEnabled: formData.get('webPushEnabled') === 'on',
    minSeverity: formData.get('minSeverity'),
    includeUnverified: formData.get('includeUnverified') === 'on',
    updatesEnabled: formData.get('updatesEnabled') === 'on',
    resolutionEnabled: formData.get('resolutionEnabled') === 'on',
    quietHoursEnabled: formData.get('quietHoursEnabled') === 'on',
    quietHoursStart: formData.get('quietHoursStart'),
    quietHoursEnd: formData.get('quietHoursEnd'),
    timezone: formData.get('timezone') || 'Africa/Algiers',
  });
  if (!parsed.success)
    return { ok: false, messageKey: parsed.error.issues[0]?.message ?? 'common.errorGeneric' };
  const p = parsed.data;
  const { error } = await supabase
    .from('notification_preferences')
    .update({
      push_enabled: p.pushEnabled,
      web_push_enabled: p.webPushEnabled,
      min_severity: p.minSeverity,
      include_unverified: p.includeUnverified,
      updates_enabled: p.updatesEnabled,
      resolution_enabled: p.resolutionEnabled,
      quiet_hours_enabled: p.quietHoursEnabled,
      quiet_hours_start: p.quietHoursStart,
      quiet_hours_end: p.quietHoursEnd,
      timezone: p.timezone,
    })
    .eq('user_id', user.id);
  if (error) return { ok: false, messageKey: 'common.errorGeneric' };
  revalidatePath('/profil/notifications');
  return { ok: true, messageKey: 'common.saved' };
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const { supabase, user } = await getSession();
  if (!supabase || !user) return;
  await supabase.rpc('mark_notifications_read', {});
  revalidatePath('/notifications');
}

export async function withdrawReportAction(formData: FormData): Promise<void> {
  const { supabase, user } = await getSession();
  const id = z.uuid().safeParse(formData.get('reportId'));
  if (!supabase || !user || !id.success) return;
  await supabase.rpc('withdraw_report', { p_report_id: id.data });
  revalidatePath('/profil/signalements');
}

/**
 * Suppression définitive du compte : le mot de passe est revérifié, puis l'utilisateur
 * est supprimé via l'API d'administration (rôle service). Les données liées sont
 * supprimées en cascade ; les signalements sont anonymisés (author_id = NULL).
 */
export async function deleteAccountAction(
  _prev: FormResult | null,
  formData: FormData,
): Promise<FormResult> {
  const { supabase, user } = await getSession();
  if (!supabase || !user || !user.email) return { ok: false, messageKey: 'common.signInRequired' };
  if (formData.get('confirmWord') !== 'SUPPRIMER')
    return { ok: false, messageKey: 'profile.deleteConfirmLabel' };
  const password = String(formData.get('password') ?? '');
  const env = getPublicEnv();
  if (!env.supabaseUrl || !env.supabasePublishableKey)
    return { ok: false, messageKey: 'connectivity.notConfigured' };
  const verifier = createClient(env.supabaseUrl, env.supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const check = await verifier.auth.signInWithPassword({ email: user.email, password });
  if (check.error || check.data.user?.id !== user.id)
    return { ok: false, messageKey: 'auth.invalidCredentials' };
  await verifier.auth.signOut();

  const service = createServiceClient();
  if (!service) return { ok: false, messageKey: 'common.notConfigured' };
  await service.rpc('service_log_audit', {
    p_actor_id: user.id,
    p_action: 'account.deleted',
    p_target_type: 'user',
    p_target_id: user.id,
    p_metadata: {},
  });
  const { error } = await service.auth.admin.deleteUser(user.id);
  if (error)
    return {
      ok: false,
      messageKey: rpcErrorCode(error) === 'unknown' ? 'common.errorGeneric' : 'common.errorGeneric',
    };
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  redirect('/?compte=supprime');
}
