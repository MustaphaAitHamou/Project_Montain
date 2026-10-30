'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { z } from 'zod';
import {
  APP_ROLES,
  approveReportSchema,
  rejectReportSchema,
  updateEventSchema,
} from '@tamurt/shared';
import { processOutbox } from '@tamurt/server';
import { getSession, isAdmin, isStaff } from '@/lib/auth';
import { rpcErrorCode } from '@/lib/errors';
import { getProviders, getServiceClient } from '@/lib/server-services';
import { getPublicEnv } from '@/lib/env';

export interface AdminResult {
  ok: boolean;
  error?: string;
}

/** Après une décision, l'outbox est traitée immédiatement (le cron reste le filet de sécurité). */
function dispatchSoon() {
  after(async () => {
    const service = getServiceClient();
    if (!service) return;
    try {
      await processOutbox(service, getProviders(), { siteUrl: getPublicEnv().siteUrl });
    } catch {
      // Le traitement planifié reprendra les entrées en attente.
    }
  });
}

async function staffSession() {
  const session = await getSession();
  if (!session.supabase || !session.user || !isStaff(session.user)) return null;
  return session as typeof session & { supabase: NonNullable<typeof session.supabase> };
}

export async function approveReportAction(
  _prev: AdminResult | null,
  formData: FormData,
): Promise<AdminResult> {
  const session = await staffSession();
  if (!session) return { ok: false, error: 'forbidden' };
  const parsed = approveReportSchema.safeParse({
    reportId: formData.get('reportId'),
    mode: formData.get('mode'),
    eventId: formData.get('eventId') || undefined,
    status: formData.get('status'),
    severity: formData.get('severity'),
    publicNote: formData.get('publicNote') || undefined,
  });
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const v = parsed.data;
  const { error } = await session.supabase.rpc('moderate_approve_report', {
    p_report_id: v.reportId,
    p_mode: v.mode,
    p_event_id: v.eventId ?? (null as unknown as string),
    p_status: v.status,
    p_severity: v.severity,
    p_public_note: v.publicNote,
  });
  if (error) return { ok: false, error: rpcErrorCode(error) };
  dispatchSoon();
  revalidatePath('/admin/moderation');
  return { ok: true };
}

export async function rejectReportAction(
  _prev: AdminResult | null,
  formData: FormData,
): Promise<AdminResult> {
  const session = await staffSession();
  if (!session) return { ok: false, error: 'forbidden' };
  const parsed = rejectReportSchema.safeParse({
    reportId: formData.get('reportId'),
    reason: formData.get('reason'),
    note: formData.get('note') || undefined,
  });
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const { error } = await session.supabase.rpc('moderate_reject_report', {
    p_report_id: parsed.data.reportId,
    p_reason: parsed.data.reason,
    p_note: parsed.data.note,
  });
  if (error) return { ok: false, error: rpcErrorCode(error) };
  revalidatePath('/admin/moderation');
  return { ok: true };
}

export async function updateEventAction(
  _prev: AdminResult | null,
  formData: FormData,
): Promise<AdminResult> {
  const session = await getSession();
  if (!session.supabase || !session.user) return { ok: false, error: 'forbidden' };
  const parsed = updateEventSchema.safeParse({
    eventId: formData.get('eventId'),
    status: formData.get('status') || undefined,
    severity: formData.get('severity') || undefined,
    publicNote: formData.get('publicNote') || undefined,
    reason: formData.get('reason'),
  });
  if (!parsed.success) return { ok: false, error: 'reason_required' };
  const v = parsed.data;
  const { error } = await session.supabase.rpc('moderate_update_event', {
    p_event_id: v.eventId,
    p_status: v.status,
    p_severity: v.severity,
    p_public_note: v.publicNote,
    p_reason: v.reason,
  });
  if (error) return { ok: false, error: rpcErrorCode(error) };
  dispatchSoon();
  revalidatePath('/admin/evenements');
  return { ok: true };
}

export async function setEventVisibilityAction(formData: FormData): Promise<void> {
  const session = await staffSession();
  if (!session) return;
  await session.supabase.rpc('moderate_set_event_visibility', {
    p_event_id: String(formData.get('eventId')),
    p_is_public: formData.get('isPublic') === 'true',
    p_reason: String(formData.get('reason') ?? 'Décision de modération'),
  });
  revalidatePath('/admin/evenements');
}

export async function decideAppealAction(formData: FormData): Promise<void> {
  const session = await staffSession();
  if (!session) return;
  await session.supabase.rpc('decide_appeal', {
    p_appeal_id: String(formData.get('appealId')),
    p_accept: formData.get('accept') === 'true',
    p_note: String(formData.get('note') ?? ''),
  });
  revalidatePath('/admin/contestations');
}

export async function handleAbuseAction(formData: FormData): Promise<void> {
  const session = await staffSession();
  if (!session) return;
  await session.supabase.rpc('handle_abuse_report', {
    p_id: String(formData.get('id')),
    p_status: String(formData.get('status')),
  });
  revalidatePath('/admin/signalements-abus');
}

export async function reviewVillageAction(formData: FormData): Promise<void> {
  const session = await staffSession();
  if (!session) return;
  await session.supabase.rpc('review_village', {
    p_village_id: String(formData.get('id')),
    p_approve: formData.get('approve') === 'true',
  });
  revalidatePath('/admin/villages');
}

export async function moderateAssistanceAction(formData: FormData): Promise<void> {
  const session = await staffSession();
  if (!session) return;
  await session.supabase.rpc('moderate_assistance_post', {
    p_id: String(formData.get('id')),
    p_status: String(formData.get('status')),
    p_verified_aid_point: formData.get('verified') === 'on',
  });
  revalidatePath('/admin/entraide');
}

const roleSchema = z.object({
  userId: z.uuid(),
  role: z.enum(APP_ROLES),
  grant: z.enum(['true', 'false']),
  reason: z.string().trim().min(3).max(500),
  organization: z.string().trim().max(120).optional(),
});

export async function setRoleAction(
  _prev: AdminResult | null,
  formData: FormData,
): Promise<AdminResult> {
  const session = await getSession();
  if (!session.supabase || !session.user || !isAdmin(session.user))
    return { ok: false, error: 'forbidden' };
  const parsed = roleSchema.safeParse({
    userId: formData.get('userId'),
    role: formData.get('role'),
    grant: formData.get('grant'),
    reason: formData.get('reason'),
    organization: formData.get('organization') || undefined,
  });
  if (!parsed.success) return { ok: false, error: 'reason_required' };
  const { error } = await session.supabase.rpc('admin_set_role', {
    p_user_id: parsed.data.userId,
    p_role: parsed.data.role,
    p_grant: parsed.data.grant === 'true',
    p_reason: parsed.data.reason,
    p_organization: parsed.data.organization,
  });
  if (error) return { ok: false, error: rpcErrorCode(error) };
  revalidatePath('/admin/utilisateurs');
  return { ok: true };
}

export async function setSuspensionAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session.supabase || !session.user || !isAdmin(session.user)) return;
  await session.supabase.rpc('admin_set_suspension', {
    p_user_id: String(formData.get('userId')),
    p_suspended: formData.get('suspended') === 'true',
    p_reason: String(formData.get('reason') ?? ''),
  });
  revalidatePath('/admin/utilisateurs');
}

const settingSchemas: Record<string, z.ZodType> = {
  demo_mode: z.boolean(),
  require_admin_mfa: z.boolean(),
  ads_enabled: z.boolean(),
  push_rate_limit_per_hour: z.number().int().min(1).max(60),
  auto_publish_categories: z.array(z.string()),
  emergency_numbers: z.object({
    verified: z.boolean(),
    verified_at: z.string().nullable(),
    verified_by: z.string().nullable().optional(),
    items: z.array(
      z.object({ label: z.string().min(1).max(80), number: z.string().regex(/^[0-9+ ]{2,20}$/) }),
    ),
  }),
};

export async function updateSettingAction(
  _prev: AdminResult | null,
  formData: FormData,
): Promise<AdminResult> {
  const session = await getSession();
  if (!session.supabase || !session.user || !isAdmin(session.user))
    return { ok: false, error: 'forbidden' };
  const key = String(formData.get('key'));
  const schema = settingSchemas[key];
  if (!schema) return { ok: false, error: 'invalid' };
  let value: unknown;
  try {
    value = JSON.parse(String(formData.get('value')));
  } catch {
    return { ok: false, error: 'invalid' };
  }
  if (
    key === 'emergency_numbers' &&
    typeof value === 'object' &&
    value &&
    (value as { verified?: boolean }).verified
  ) {
    (value as Record<string, unknown>).verified_at = new Date().toISOString();
    (value as Record<string, unknown>).verified_by = session.user.id;
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const { error } = await session.supabase.rpc('admin_update_setting', {
    p_key: key,
    p_value: parsed.data as never,
  });
  if (error) return { ok: false, error: rpcErrorCode(error) };
  revalidatePath('/admin/parametres');
  return { ok: true };
}
