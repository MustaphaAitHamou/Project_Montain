import { type FollowedPlaceInput, followedPlaceInputSchema, rpcErrorCode } from '@tamurt/shared';
import { supabase } from './supabase';

export type PlaceResultOutcome = { ok: true; id: string } | { ok: false; error: string };

/** Création d'un lieu suivi (RLS : l'utilisateur ne peut écrire que ses propres lieux). */
export async function createFollowedPlace(
  userId: string,
  input: unknown,
): Promise<PlaceResultOutcome> {
  if (!supabase) return { ok: false, error: 'not_configured' };
  const parsed = followedPlaceInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const v: FollowedPlaceInput = parsed.data;
  const { data, error } = await supabase
    .from('user_followed_places')
    .insert({
      user_id: userId,
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
  return { ok: true, id: data.id };
}
