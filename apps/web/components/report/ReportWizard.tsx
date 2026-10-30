'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ImagePlus, Trash2 } from 'lucide-react';
import {
  ACCEPTED_IMAGE_MIME_TYPES,
  DEFAULT_UNCERTAINTY_M,
  KABYLIE_REGION,
  LIMITS,
  type CategoryId,
  type LocationPrecision,
  createReportSubmissionSchema,
  getCategory,
  isWithinBBox,
  reportableAlertCategories,
  reportableSubcategories,
} from '@tamurt/shared';
import { getTranslator, type Locale } from '@tamurt/shared/i18n';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { reencodeImage } from '@/lib/image';
import { enqueueReport } from '@/lib/offlineQueue';
import { errorMessageKey, rpcErrorCode } from '@/lib/errors';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { LocationPicker, type LatLngValue } from '@/components/map/LocationPicker';

type Step = 'category' | 'subcategory' | 'location' | 'details' | 'media' | 'time' | 'review';
const STEPS: Step[] = ['category', 'subcategory', 'location', 'details', 'media', 'time', 'review'];

function localDateTimeValue(date: Date): string {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

type Outcome =
  | { kind: 'success'; reportId: string; duplicates: number; photoFailed: boolean }
  | { kind: 'queued' };

export function ReportWizard({ locale, userId }: { locale: Locale; userId: string }) {
  const { t, tk } = useMemo(() => getTranslator(locale), [locale]);
  const [clientId] = useState(() => crypto.randomUUID());
  const [step, setStep] = useState<Step>('category');
  const [categoryId, setCategoryId] = useState<CategoryId | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [location, setLocation] = useState<LatLngValue | null>(null);
  const [precision, setPrecision] = useState<LocationPrecision>('approximate');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [observedAt, setObservedAt] = useState(() => localDateTimeValue(new Date()));
  const [certified, setCertified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const category = categoryId ? getCategory(categoryId) : null;
  const stepIndex = STEPS.indexOf(step);
  const uncertainty = DEFAULT_UNCERTAINTY_M[precision];

  const payload = () => ({
    clientId,
    categoryId: categoryId ?? '',
    subcategoryId: subcategoryId ?? '',
    description: description.trim(),
    location: location ?? { lat: NaN, lng: NaN },
    locationPrecision: precision,
    locationUncertaintyM: uncertainty,
    observedAt: new Date(observedAt).toISOString(),
  });

  const validationIssues = (fields: string[]): string[] => {
    const result = createReportSubmissionSchema().safeParse(payload());
    if (result.success) return [];
    return result.error.issues
      .filter((i) => fields.includes(String(i.path[0])))
      .map((i) => i.message);
  };

  const canContinue = (): boolean => {
    switch (step) {
      case 'category':
        return Boolean(categoryId);
      case 'subcategory':
        return Boolean(subcategoryId);
      case 'location':
        return Boolean(location) && validationIssues(['locationPrecision']).length === 0;
      case 'details':
        return validationIssues(['description']).length === 0;
      case 'time':
        return validationIssues(['observedAt']).length === 0;
      case 'review':
        return certified;
      default:
        return true;
    }
  };

  const go = (delta: number) => {
    setError(null);
    const next = STEPS[Math.min(Math.max(stepIndex + delta, 0), STEPS.length - 1)];
    if (next) setStep(next);
  };

  const onPhoto = async (file: File | undefined) => {
    setPhotoError(null);
    if (!file) return;
    if (!(ACCEPTED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
      setPhotoError(t('report.photoType'));
      return;
    }
    if (file.size > LIMITS.mediaMaxBytes * 3) {
      setPhotoError(t('report.photoTooLarge'));
      return;
    }
    try {
      const blob = await reencodeImage(file);
      if (blob.size > LIMITS.mediaMaxBytes) {
        setPhotoError(t('report.photoTooLarge'));
        return;
      }
      if (photo) URL.revokeObjectURL(photo.url);
      setPhoto({ blob, url: URL.createObjectURL(blob) });
    } catch {
      setPhotoError(t('report.photoType'));
    }
  };

  const submit = async () => {
    setError(null);
    const parsed = createReportSubmissionSchema().safeParse(payload());
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'common.errorGeneric');
      return;
    }
    if (location && !isWithinBBox(location, KABYLIE_REGION.bbox)) {
      setError('report.outsideCoverage');
      return;
    }
    const params = {
      p_client_id: clientId,
      p_category_id: parsed.data.categoryId,
      p_subcategory_id: parsed.data.subcategoryId,
      p_description: parsed.data.description,
      p_lat: parsed.data.location.lat,
      p_lng: parsed.data.location.lng,
      p_location_precision: parsed.data.locationPrecision,
      p_location_uncertainty_m: uncertainty,
      p_observed_at: parsed.data.observedAt,
    };
    if (!navigator.onLine) {
      enqueueReport({ ...params, queuedAt: new Date().toISOString() });
      setOutcome({ kind: 'queued' });
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError('connectivity.notConfigured');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('submit_report', params);
      if (rpcError) {
        if (rpcError.message?.includes('Failed to fetch')) {
          enqueueReport({ ...params, queuedAt: new Date().toISOString() });
          setOutcome({ kind: 'queued' });
          return;
        }
        setError(errorMessageKey(rpcErrorCode(rpcError)));
        return;
      }
      const result = data as { report_id: string; possible_duplicates?: string[] };
      let photoFailed = false;
      if (photo) {
        const path = `${userId}/${result.report_id}/${crypto.randomUUID()}.jpg`;
        const upload = await supabase.storage
          .from('report-media-quarantine')
          .upload(path, photo.blob, { contentType: 'image/jpeg', upsert: false });
        if (upload.error) {
          photoFailed = true;
        } else {
          const registered = await supabase.rpc('register_report_media', {
            p_report_id: result.report_id,
            p_path: path,
          });
          photoFailed = Boolean(registered.error);
        }
      }
      setOutcome({
        kind: 'success',
        reportId: result.report_id,
        duplicates: result.possible_duplicates?.length ?? 0,
        photoFailed,
      });
    } catch {
      enqueueReport({ ...params, queuedAt: new Date().toISOString() });
      setOutcome({ kind: 'queued' });
    } finally {
      setSubmitting(false);
    }
  };

  if (outcome) {
    return (
      <div className="card stack" role="status">
        {outcome.kind === 'success' ? (
          <>
            <h2>{t('report.successTitle')}</h2>
            <p>{t('report.successBody')}</p>
            {outcome.duplicates > 0 && (
              <p className="banner banner-info">{t('report.duplicateHint')}</p>
            )}
            {outcome.photoFailed && (
              <p className="banner banner-warning">{t('common.errorGeneric')}</p>
            )}
          </>
        ) : (
          <p className="banner banner-warning">{t('report.queuedOffline')}</p>
        )}
        <div className="row">
          <Link href="/profil/signalements" className="btn btn-outline">
            {t('report.myReports')}
          </Link>
          <Link href="/" className="btn btn-primary">
            {t('nav.home')}
          </Link>
        </div>
      </div>
    );
  }

  const stepTitles: Record<Step, string> = {
    category: t('report.chooseCategory'),
    subcategory: t('report.chooseSubcategory'),
    location: t('report.locationTitle'),
    details: t('report.descriptionLabel'),
    media: t('report.photoLabel'),
    time: t('report.observedAtLabel'),
    review: t('report.reviewTitle'),
  };
  const descriptionIssues =
    step === 'details' && description.length > 0 ? validationIssues(['description']) : [];
  const timeIssues = step === 'time' ? validationIssues(['observedAt']) : [];
  const precisionIssues = step === 'location' ? validationIssues(['locationPrecision']) : [];

  return (
    <div className="stack">
      <div className="stack-sm">
        <p className="small muted" aria-live="polite">
          {t('report.stepOf', { current: stepIndex + 1, total: STEPS.length })}
        </p>
        <ol className="steps" aria-hidden="true">
          {STEPS.map((s, i) => (
            <li key={s} data-done={i <= stepIndex} />
          ))}
        </ol>
      </div>

      <section className="card stack" aria-labelledby="step-title">
        <h2 id="step-title">{stepTitles[step]}</h2>

        {step === 'category' && (
          <>
            <div className="choice-grid" role="radiogroup" aria-labelledby="step-title">
              {reportableAlertCategories().map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={categoryId === c.id}
                  className="choice"
                  onClick={() => {
                    setCategoryId(c.id);
                    setSubcategoryId(null);
                    if (!c.validation.allowUncertainLocation && precision === 'uncertain')
                      setPrecision('approximate');
                  }}
                >
                  <CategoryIcon categoryId={c.id} withBackground size={20} />
                  <strong>{tk(`category.${c.id}`)}</strong>
                </button>
              ))}
            </div>
            <p className="small muted">
              {t('report.assistanceRedirect')} <Link href="/entraide">{t('nav.assistance')}</Link>
            </p>
          </>
        )}

        {step === 'subcategory' && categoryId && (
          <div className="choice-grid" role="radiogroup" aria-labelledby="step-title">
            {reportableSubcategories(categoryId).map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={subcategoryId === s.id}
                className="choice"
                onClick={() => setSubcategoryId(s.id)}
              >
                <strong>{tk(`subcategory.${s.id}`)}</strong>
              </button>
            ))}
          </div>
        )}

        {step === 'location' && (
          <>
            <p className="small">{t('report.locationHelp')}</p>
            <LocationPicker
              value={location}
              onChange={setLocation}
              uncertaintyM={uncertainty}
              labels={{
                useGps: t('report.useGps'),
                gpsHint: t('report.gpsHint'),
                tapToPlace: t('report.tapToPlace'),
                locating: t('map.locating'),
                denied: t('map.locationDenied'),
                unavailable: t('map.locationUnavailable'),
                searchPlaceholder: t('map.searchPlaceholder'),
                searchLabel: t('map.searchLabel'),
                mapLabel: t('report.locationTitle'),
              }}
            />
            <fieldset className="stack-sm">
              <legend>{t('report.precision')}</legend>
              {(['exact', 'approximate', 'uncertain'] as const).map((p) => {
                const disabled =
                  p === 'uncertain' && category
                    ? !category.validation.allowUncertainLocation
                    : false;
                return (
                  <label key={p} className="checkbox-row" style={{ opacity: disabled ? 0.5 : 1 }}>
                    <input
                      type="radio"
                      name="precision"
                      value={p}
                      checked={precision === p}
                      disabled={disabled}
                      onChange={() => setPrecision(p)}
                    />
                    {p === 'exact'
                      ? t('report.precisionExact')
                      : p === 'approximate'
                        ? t('report.precisionApproximate')
                        : t('report.precisionUncertain')}
                  </label>
                );
              })}
            </fieldset>
            {precisionIssues.map((m) => (
              <p key={m} className="error" role="alert">
                {tk(m)}
              </p>
            ))}
          </>
        )}

        {step === 'details' && (
          <div className="field">
            <label htmlFor="report-description">{t('report.descriptionLabel')}</label>
            <p id="report-description-help" className="hint">
              {t('report.descriptionHelp')}
            </p>
            <textarea
              id="report-description"
              className="textarea"
              value={description}
              maxLength={LIMITS.descriptionMaxLength}
              onChange={(e) => setDescription(e.target.value)}
              aria-describedby="report-description-help report-description-count"
              aria-invalid={descriptionIssues.length > 0}
            />
            <p id="report-description-count" className="hint">
              {t('report.descriptionCount', {
                count: description.length,
                max: LIMITS.descriptionMaxLength,
              })}
            </p>
            {descriptionIssues.map((m) => (
              <p key={m} className="error" role="alert">
                {tk(m)}
              </p>
            ))}
          </div>
        )}

        {step === 'media' && (
          <div className="stack-sm">
            <p className="small">{t('report.photoHelp')}</p>
            {photo ? (
              <div className="stack-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt="" style={{ maxWidth: 320, borderRadius: 12 }} />
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    URL.revokeObjectURL(photo.url);
                    setPhoto(null);
                  }}
                >
                  <Trash2 size={18} aria-hidden="true" /> {t('report.photoRemove')}
                </button>
              </div>
            ) : (
              <label className="btn btn-outline" style={{ alignSelf: 'flex-start' }}>
                <ImagePlus size={18} aria-hidden="true" /> {t('report.photoLabel')} (
                {t('common.optional')})
                <input
                  type="file"
                  accept={ACCEPTED_IMAGE_MIME_TYPES.join(',')}
                  className="sr-only"
                  onChange={(e) => void onPhoto(e.target.files?.[0])}
                />
              </label>
            )}
            {photoError && (
              <p className="error" role="alert">
                {photoError}
              </p>
            )}
            <p className="small muted">{t('report.videoUnavailable')}</p>
          </div>
        )}

        {step === 'time' && (
          <div className="field">
            <label htmlFor="observed-at">{t('report.observedAtLabel')}</label>
            <div className="row">
              <input
                id="observed-at"
                type="datetime-local"
                className="input"
                style={{ maxWidth: 260 }}
                value={observedAt}
                onChange={(e) => setObservedAt(e.target.value)}
                aria-invalid={timeIssues.length > 0}
              />
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setObservedAt(localDateTimeValue(new Date()))}
              >
                {t('report.observedNow')}
              </button>
            </div>
            {timeIssues.map((m) => (
              <p key={m} className="error" role="alert">
                {tk(m)}
              </p>
            ))}
          </div>
        )}

        {step === 'review' && categoryId && subcategoryId && location && (
          <div className="stack-sm">
            <dl className="stack-sm" style={{ margin: 0 }}>
              <div>
                <dt className="small muted">{t('report.stepCategory')}</dt>
                <dd style={{ margin: 0 }}>
                  {tk(`category.${categoryId}`)} — {tk(`subcategory.${subcategoryId}`)}
                </dd>
              </div>
              <div>
                <dt className="small muted">{t('report.stepLocation')}</dt>
                <dd style={{ margin: 0 }}>
                  {location.lat.toFixed(5)}, {location.lng.toFixed(5)} ·{' '}
                  {precision === 'exact'
                    ? t('report.precisionExact')
                    : precision === 'approximate'
                      ? t('report.precisionApproximate')
                      : t('report.precisionUncertain')}
                </dd>
              </div>
              <div>
                <dt className="small muted">{t('report.descriptionLabel')}</dt>
                <dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{description}</dd>
              </div>
              <div>
                <dt className="small muted">{t('report.observedAtLabel')}</dt>
                <dd style={{ margin: 0 }}>
                  {new Date(observedAt).toLocaleString(locale === 'ar' ? 'ar-DZ' : 'fr-FR')}
                </dd>
              </div>
              {photo && (
                <div>
                  <dt className="small muted">{t('report.stepMedia')}</dt>
                  <dd style={{ margin: 0 }}>✓</dd>
                </div>
              )}
            </dl>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={certified}
                onChange={(e) => setCertified(e.target.checked)}
              />
              <span className="small">{t('report.certify')}</span>
            </label>
          </div>
        )}

        {error && (
          <p className="banner banner-danger" role="alert">
            {tk(error)}
          </p>
        )}

        <div className="row-between">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => go(-1)}
            disabled={stepIndex === 0 || submitting}
          >
            {t('common.previous')}
          </button>
          {step === 'review' ? (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => void submit()}
              disabled={!canContinue() || submitting}
            >
              {submitting ? t('report.submitting') : t('report.submit')}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => go(1)}
              disabled={!canContinue()}
            >
              {t('common.next')}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
