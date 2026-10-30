'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { CATEGORY_IDS, SEVERITIES, followedPlaceInputSchema } from '@tamurt/shared';
import { getSession } from '@/lib/auth';
import { rpcErrorCode } from '@/lib/errors';

export interface VillageActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

export async function createFollowedPlaceAction(input: unknown): Promise<VillageActionResult> {
  const { supabase, user } = await getSession();
  if (!supabase || !user) return { ok: false, error: 'not_authenticated' };
  const parsed = followedPlaceInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const v = parsed.data;
  const { data, error } = await supabase
    .from('user_followed_places')
    .insert({
      user_id: user.id,
      label: v.label,
      place_type: v.placeType,
      commune_code: v.communeCode ?? null,
      village_id: v.villageId ?? null,
      // Pour une commune ou un village, la position est recalculée côté base.
      location: `SRID=4326;POINT(${v.location.lng} ${v.location.lat})`,
      radius_m: v.radiusM,
      categories: v.categories,
      notify: v.notify,
      min_severity: v.minSeverity ?? null,
    })
    .select('id')
    .single();
  if (error) return { ok: false, error: rpcErrorCode(error) };
  revalidatePath('/villages');
  return { ok: true, id: data.id };
}

const updateSchema = z.object({
  id: z.uuid(),
  label: z.string().trim().min(1).max(60),
  radiusM: z.coerce.number().int().min(500).max(30000),
  categories: z.array(z.enum(CATEGORY_IDS)),
  notify: z.boolean(),
  minSeverity: z.enum(SEVERITIES).nullable(),
});

export async function updateFollowedPlaceAction(
  _prev: VillageActionResult | null,
  formData: FormData,
): Promise<VillageActionResult> {
  const { supabase, user } = await getSession();
  if (!supabase || !user) return { ok: false, error: 'not_authenticated' };
  const parsed = updateSchema.safeParse({
    id: formData.get('id'),
    label: formData.get('label'),
    radiusM: formData.get('radiusM'),
    categories: formData.getAll('categories'),
    notify: formData.get('notify') === 'on',
    minSeverity: formData.get('minSeverity') || null,
  });
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const v = parsed.data;
  const { error } = await supabase
    .from('user_followed_places')
    .update({
      label: v.label,
      radius_m: v.radiusM,
      categories: v.categories,
      notify: v.notify,
      min_severity: v.minSeverity,
    })
    .eq('id', v.id)
    .eq('user_id', user.id);
  if (error) return { ok: false, error: rpcErrorCode(error) };
  revalidatePath('/villages');
  revalidatePath(`/villages/${v.id}`);
  return { ok: true, id: v.id };
}

export async function deleteFollowedPlaceAction(formData: FormData): Promise<void> {
  const { supabase, user } = await getSession();
  const id = z.uuid().safeParse(formData.get('id'));
  if (!supabase || !user || !id.success) return;
  await supabase.from('user_followed_places').delete().eq('id', id.data).eq('user_id', user.id);
  revalidatePath('/villages');
  redirect('/villages');
}

export async function proposeVillageAction(input: unknown): Promise<VillageActionResult> {
  const { supabase, user } = await getSession();
  if (!supabase || !user) return { ok: false, error: 'not_authenticated' };
  const parsed = z
    .object({ name: z.string().trim().min(2).max(120), lat: z.number(), lng: z.number() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const { data, error } = await supabase.rpc('propose_village', {
    p_name: parsed.data.name,
    p_lat: parsed.data.lat,
    p_lng: parsed.data.lng,
  });
  if (error) return { ok: false, error: rpcErrorCode(error) };
  return { ok: true, id: data as string };
}
