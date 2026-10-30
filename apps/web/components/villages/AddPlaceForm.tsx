'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Search } from 'lucide-react';
import {
  CATEGORIES,
  LIMITS,
  SEVERITIES,
  WATCH_RADIUS_DEFAULT_M,
  WATCH_RADIUS_OPTIONS_M,
  formatDistance,
  type CategoryId,
  type Severity,
} from '@tamurt/shared';
import { getTranslator, type Locale } from '@tamurt/shared/i18n';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { createFollowedPlaceAction, proposeVillageAction } from '@/app/actions/villages';
import { errorMessageKey } from '@/lib/errors';
import { LocationPicker, type LatLngValue } from '@/components/map/LocationPicker';
import { CategoryIcon } from '@/components/ui/CategoryIcon';

interface PlaceResult {
  kind: 'commune' | 'village' | 'wilaya';
  id: string;
  name_fr: string;
  name_ar: string | null;
  commune_code: string | null;
  commune_name_fr: string | null;
  wilaya_name_fr: string | null;
  lat: number;
  lng: number;
}

export function AddPlaceForm({ locale }: { locale: Locale }) {
  const { t, tk } = useMemo(() => getTranslator(locale), [locale]);
  const router = useRouter();
  const [mode, setMode] = useState<'search' | 'custom'>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [selected, setSelected] = useState<PlaceResult | null>(null);
  const [customPoint, setCustomPoint] = useState<LatLngValue | null>(null);
  const [label, setLabel] = useState('');
  const [radius, setRadius] = useState<number>(WATCH_RADIUS_DEFAULT_M);
  const [categories, setCategories] = useState<CategoryId[]>([]);
  const [notify, setNotify] = useState(true);
  const [minSeverity, setMinSeverity] = useState<Severity | ''>('');
  const [proposeVillage, setProposeVillage] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (mode !== 'search' || q.length < 2) return;
    const timer = window.setTimeout(async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = (await supabase?.rpc('search_places', { q, max_results: 10 })) ?? {
        data: [],
      };
      setResults(((data ?? []) as PlaceResult[]).filter((r) => r.kind !== 'wilaya'));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, mode]);

  const visibleResults = mode === 'search' && query.trim().length >= 2 ? results : [];
  const placeName = (r: PlaceResult) => (locale === 'ar' && r.name_ar ? r.name_ar : r.name_fr);
  const ready = mode === 'search' ? Boolean(selected) : Boolean(customPoint && label.trim());

  const submit = async () => {
    setError(null);
    setPending(true);
    const base = {
      radiusM: radius,
      categories,
      notify,
      minSeverity: minSeverity || null,
    };
    const input =
      mode === 'search' && selected
        ? {
            ...base,
            label: (label.trim() || placeName(selected)).slice(0, 60),
            placeType: selected.kind,
            communeCode: selected.kind === 'commune' ? selected.id : null,
            villageId: selected.kind === 'village' ? selected.id : null,
            location: { lat: selected.lat, lng: selected.lng },
          }
        : { ...base, label: label.trim(), placeType: 'custom', location: customPoint };
    const result = await createFollowedPlaceAction(input);
    if (result.ok && mode === 'custom' && proposeVillage && customPoint) {
      // Proposition au référentiel : invisible des autres tant qu'elle n'est pas validée.
      await proposeVillageAction({
        name: label.trim(),
        lat: customPoint.lat,
        lng: customPoint.lng,
      });
    }
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'unknown');
      return;
    }
    router.push(`/villages/${result.id}`);
    router.refresh();
  };

  return (
    <div className="stack">
      <div className="row" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'search'}
          className={mode === 'search' ? 'chip active' : 'chip'}
          onClick={() => setMode('search')}
        >
          <Search size={16} aria-hidden="true" /> {t('villages.searchPlaceholder')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'custom'}
          className={mode === 'custom' ? 'chip active' : 'chip'}
          onClick={() => setMode('custom')}
        >
          <MapPin size={16} aria-hidden="true" /> {t('villages.customPlace')}
        </button>
      </div>

      {mode === 'search' ? (
        <div className="field" style={{ position: 'relative' }}>
          <label htmlFor="place-search">{t('villages.add')}</label>
          <input
            id="place-search"
            className="input"
            placeholder={t('villages.searchPlaceholder')}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
            }}
            autoComplete="off"
          />
          {query.trim().length >= 2 && visibleResults.length === 0 && !selected && (
            <p className="hint">{t('villages.noResults')}</p>
          )}
          {visibleResults.length > 0 && !selected && (
            <ul className="list-plain stack-sm" role="listbox" aria-label={t('villages.add')}>
              {visibleResults.map((r) => (
                <li key={`${r.kind}-${r.id}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected="false"
                    className="card card-link btn-block"
                    style={{ textAlign: 'start', cursor: 'pointer' }}
                    onClick={() => {
                      setSelected(r);
                      setLabel(placeName(r));
                      setQuery(placeName(r));
                    }}
                  >
                    <strong>{placeName(r)}</strong>{' '}
                    <span className="small muted">
                      · {tk(`villages.placeType.${r.kind}`)}
                      {r.kind === 'village' && r.commune_name_fr ? ` · ${r.commune_name_fr}` : ''}
                      {r.wilaya_name_fr ? ` · ${r.wilaya_name_fr}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {selected && (
            <p className="banner banner-success">
              {placeName(selected)} — {tk(`villages.placeType.${selected.kind}`)}
              {selected.wilaya_name_fr ? `, ${selected.wilaya_name_fr}` : ''}
            </p>
          )}
        </div>
      ) : (
        <LocationPicker
          value={customPoint}
          onChange={setCustomPoint}
          uncertaintyM={radius}
          labels={{
            useGps: t('report.useGps'),
            gpsHint: t('report.gpsHint'),
            tapToPlace: t('report.tapToPlace'),
            locating: t('map.locating'),
            denied: t('map.locationDenied'),
            unavailable: t('map.locationUnavailable'),
            searchPlaceholder: t('map.searchPlaceholder'),
            searchLabel: t('map.searchLabel'),
            mapLabel: t('villages.customPlace'),
          }}
        />
      )}
      {mode === 'custom' && (
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={proposeVillage}
            onChange={(e) => setProposeVillage(e.target.checked)}
          />
          {t('villages.proposeAsVillage')}
        </label>
      )}

      <div className="field">
        <label htmlFor="place-label">{t('villages.customLabel')}</label>
        <input
          id="place-label"
          className="input"
          maxLength={60}
          placeholder={t('villages.customLabelPlaceholder')}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="place-radius">{t('villages.radius')}</label>
        <select
          id="place-radius"
          className="select"
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
        >
          {WATCH_RADIUS_OPTIONS_M.map((r) => (
            <option key={r} value={r}>
              {t('villages.radiusValue', { distance: formatDistance(r) })}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="stack-sm">
        <legend>{t('villages.categories')}</legend>
        <p className="hint">{categories.length === 0 ? t('villages.allCategories') : ''}</p>
        <div className="row">
          {CATEGORIES.filter((c) => c.module === 'alerts').map((c) => (
            <label key={c.id} className="chip">
              <input
                type="checkbox"
                checked={categories.includes(c.id)}
                onChange={(e) =>
                  setCategories((current) =>
                    e.target.checked ? [...current, c.id] : current.filter((id) => id !== c.id),
                  )
                }
              />
              <CategoryIcon categoryId={c.id} size={16} />
              {tk(`category.${c.id}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="checkbox-row">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
        {t('villages.notify')}
      </label>

      <div className="field">
        <label htmlFor="place-severity">{t('villages.minSeverity')}</label>
        <select
          id="place-severity"
          className="select"
          value={minSeverity}
          onChange={(e) => setMinSeverity(e.target.value as Severity | '')}
        >
          <option value="">{t('villages.useGlobal')}</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {tk(`severity.${s}`)}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="banner banner-danger" role="alert">
          {error === 'outside_coverage'
            ? t('report.outsideCoverage')
            : tk(errorMessageKey(error), { max: LIMITS.followedPlacesMax })}
        </p>
      )}
      <button
        type="button"
        className="btn btn-primary"
        disabled={!ready || pending}
        onClick={() => void submit()}
      >
        {pending ? t('common.loading') : t('common.save')}
      </button>
    </div>
  );
}
