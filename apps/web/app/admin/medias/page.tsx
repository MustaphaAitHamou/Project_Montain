import { formatDateTime } from '@tamurt/shared';
import { getI18n } from '@/lib/i18n';
import { getSession } from '@/lib/auth';
import { MediaModeration } from '@/components/admin/MediaModeration';

export const dynamic = 'force-dynamic';

export default async function AdminMedia() {
  const { t, locale } = await getI18n();
  const { supabase } = await getSession();
  if (!supabase) return null;
  const { data } = await supabase
    .from('alert_media')
    .select('id, report_id, quarantine_path, mime_type, size_bytes, created_at')
    .eq('status', 'quarantine')
    .order('created_at')
    .limit(30);
  const items = data ?? [];
  // URLs signées de courte durée (politique Storage : équipe de modération uniquement).
  const signed = await Promise.all(
    items.map(async (m) => {
      const { data: url } = await supabase.storage
        .from('report-media-quarantine')
        .createSignedUrl(m.quarantine_path, 300);
      return [m.id, url?.signedUrl ?? null] as const;
    }),
  );
  const urls = new Map(signed);
  return (
    <>
      <h1>{t('admin.media')}</h1>
      <p className="small muted">
        Les photos restent privées tant qu’elles ne sont pas publiées. La publication crée une copie
        ré-encodée sans métadonnées (EXIF, GPS) et supprime l’original. Vérifiez l’absence de
        personnes reconnaissables et de données personnelles. Le signalement doit d’abord être
        validé.
      </p>
      {items.length === 0 ? (
        <div className="card empty-state">
          <p>Aucune photo en attente.</p>
        </div>
      ) : (
        <ul className="list-plain grid-2">
          {items.map((m) => (
            <li key={m.id} className="card stack-sm">
              {urls.get(m.id) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={urls.get(m.id) ?? ''}
                  alt="Photo en quarantaine"
                  style={{ maxWidth: '100%', borderRadius: 8 }}
                />
              ) : (
                <p className="muted">Aperçu indisponible</p>
              )}
              <p className="small muted" style={{ margin: 0 }}>
                {m.mime_type} · {Math.round(m.size_bytes / 1024)} Ko ·{' '}
                {formatDateTime(m.created_at, locale)}
              </p>
              <MediaModeration mediaId={m.id} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
