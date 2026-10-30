'use server';

import { revalidatePath } from 'next/cache';
import { assistancePostSchema } from '@tamurt/shared';
import { getSession } from '@/lib/auth';
import { rpcErrorCode } from '@/lib/errors';

export interface AssistanceResult {
  ok: boolean;
  error?: string;
}

export async function createAssistanceAction(
  _prev: AssistanceResult | null,
  formData: FormData,
): Promise<AssistanceResult> {
  const { supabase, user } = await getSession();
  if (!supabase || !user) return { ok: false, error: 'not_authenticated' };
  const parsed = assistancePostSchema.safeParse({
    kind: formData.get('kind'),
    title: formData.get('title'),
    description: formData.get('description'),
    communeCode: formData.get('communeCode'),
    expiresInDays: Number(formData.get('expiresInDays')),
  });
  if (!parsed.success) {
    const personal = parsed.error.issues.some(
      (i) => i.message === 'validation.no_personal_contact',
    );
    return { ok: false, error: personal ? 'personal_contact_not_allowed' : 'invalid' };
  }
  const v = parsed.data;
  const { error } = await supabase.rpc('create_assistance_post', {
    p_kind: v.kind,
    p_title: v.title,
    p_description: v.description,
    p_commune_code: v.communeCode,
    p_expires_in_days: v.expiresInDays,
  });
  if (error) return { ok: false, error: rpcErrorCode(error) };
  revalidatePath('/entraide');
  return { ok: true };
}
