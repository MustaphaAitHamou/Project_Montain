'use server';

import { abuseReportSchema, appealSchema } from '@tamurt/shared';
import { getSession } from '@/lib/auth';
import { rpcErrorCode } from '@/lib/errors';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function reportAbuseAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const { supabase, user } = await getSession();
  if (!supabase || !user) return { ok: false, error: 'not_authenticated' };
  const parsed = abuseReportSchema.safeParse({
    targetType: formData.get('targetType'),
    targetId: formData.get('targetId'),
    reason: formData.get('reason'),
    details: formData.get('details') || undefined,
  });
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const { error } = await supabase.rpc('create_abuse_report', {
    p_target_type: parsed.data.targetType,
    p_target_id: parsed.data.targetId,
    p_reason: parsed.data.reason,
    p_details: parsed.data.details ?? undefined,
  });
  return error ? { ok: false, error: rpcErrorCode(error) } : { ok: true };
}

export async function appealAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const { supabase, user } = await getSession();
  if (!supabase || !user) return { ok: false, error: 'not_authenticated' };
  const parsed = appealSchema.safeParse({
    reportId: formData.get('reportId'),
    message: formData.get('message'),
  });
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const { error } = await supabase.rpc('create_appeal', {
    p_report_id: parsed.data.reportId,
    p_message: parsed.data.message,
  });
  return error ? { ok: false, error: rpcErrorCode(error) } : { ok: true };
}
