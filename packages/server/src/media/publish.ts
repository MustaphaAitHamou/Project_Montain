import { createHash, randomUUID } from 'node:crypto';
import type { ServiceClient } from '../supabase';
import { processImageForPublication } from './process';

export const QUARANTINE_BUCKET = 'report-media-quarantine';
export const PUBLIC_BUCKET = 'report-media-public';

/**
 * Décision d'un modérateur sur une photo en quarantaine. L'appelant (route serveur)
 * DOIT avoir vérifié que l'acteur est modérateur ou administrateur.
 * - Approbation : ré-encodage sans métadonnées → bucket public → suppression de l'original.
 * - Rejet : suppression de l'original.
 */
export async function moderateMedia(
  service: ServiceClient,
  mediaId: string,
  approve: boolean,
  actorId: string,
): Promise<{ status: 'approved' | 'rejected' | 'processing_failed'; publicPath?: string }> {
  const { data: media, error } = await service
    .from('alert_media')
    .select('id, report_id, quarantine_path, status')
    .eq('id', mediaId)
    .single();
  if (error || !media) throw new Error('not_found');
  if (media.status !== 'quarantine') throw new Error('already_moderated');

  const { data: report } = await service
    .from('alert_reports')
    .select('event_id')
    .eq('id', media.report_id)
    .single();

  if (!approve) {
    await service.storage.from(QUARANTINE_BUCKET).remove([media.quarantine_path]);
    await service
      .from('alert_media')
      .update({ status: 'rejected', moderated_by: actorId, moderated_at: new Date().toISOString() })
      .eq('id', mediaId);
    await service.rpc('service_log_audit', {
      p_actor_id: actorId,
      p_action: 'media.rejected',
      p_target_type: 'media',
      p_target_id: mediaId,
      p_metadata: {},
    });
    return { status: 'rejected' };
  }
  if (!report?.event_id) throw new Error('report_not_published');

  const { data: blob, error: downloadError } = await service.storage
    .from(QUARANTINE_BUCKET)
    .download(media.quarantine_path);
  if (downloadError || !blob) throw new Error('download_failed');

  try {
    const processed = await processImageForPublication(Buffer.from(await blob.arrayBuffer()));
    const publicPath = `${report.event_id}/${randomUUID()}.webp`;
    const upload = await service.storage
      .from(PUBLIC_BUCKET)
      .upload(publicPath, processed.data, { contentType: processed.contentType, upsert: false });
    if (upload.error) throw new Error(upload.error.message);
    await service
      .from('alert_media')
      .update({
        status: 'approved',
        public_path: publicPath,
        event_id: report.event_id,
        width: processed.width,
        height: processed.height,
        sha256: createHash('sha256').update(processed.data).digest('hex'),
        exif_stripped: true,
        moderated_by: actorId,
        moderated_at: new Date().toISOString(),
      })
      .eq('id', mediaId);
    // L'original (avec ses éventuelles métadonnées) n'est pas conservé.
    await service.storage.from(QUARANTINE_BUCKET).remove([media.quarantine_path]);
    await service.rpc('service_log_audit', {
      p_actor_id: actorId,
      p_action: 'media.approved',
      p_target_type: 'media',
      p_target_id: mediaId,
      p_metadata: { event_id: report.event_id },
    });
    return { status: 'approved', publicPath };
  } catch (err) {
    await service
      .from('alert_media')
      .update({
        status: 'processing_failed',
        moderated_by: actorId,
        moderated_at: new Date().toISOString(),
      })
      .eq('id', mediaId);
    throw err;
  }
}
