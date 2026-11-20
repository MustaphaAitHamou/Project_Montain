import type { Metadata } from 'next';
import { getI18n } from '@/lib/i18n';
import { getSession } from '@/lib/auth';
import { listActiveEvents } from '@/lib/data/events';
import { EventMap, type FollowedArea } from '@/components/map/EventMap';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('map.title') };
}

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ lat?: string; lng?: string; z?: string }>;
}) {
  const { t, locale } = await getI18n();
  const { supabase, user } = await getSession();
  const params = await searchParams;
  const { events, fetchedAt } = supabase
    ? await listActiveEvents(supabase, 500)
    : { events: [], fetchedAt: new Date().toISOString() };

  let followedAreas: FollowedArea[] = [];
  if (supabase && user) {
    const { data } = await supabase.rpc('my_followed_places_summary');
    followedAreas = (data ?? []).map((f) => ({
      id: f.id,
      label: f.label,
      lat: f.lat,
      lng: f.lng,
      radiusM: f.radius_m,
    }));
  }

  const lat = Number(params.lat);
  const lng = Number(params.lng);
  const zoom = Number(params.z);
  const initialCenter =
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
      ? { lat, lng, zoom: Number.isFinite(zoom) ? Math.min(Math.max(zoom, 5), 17) : 12 }
      : undefined;

  return (
    <main className="page container container-wide stack" id="contenu">
      <h1>{t('map.title')}</h1>
      <EventMap
        locale={locale}
        variant="full"
        initialEvents={events}
        initialFetchedAt={fetchedAt}
        followedAreas={followedAreas}
        initialCenter={initialCenter}
      />
    </main>
  );
}
