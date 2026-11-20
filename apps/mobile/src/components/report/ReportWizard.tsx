import { useState } from 'react';
import { Image, Linking, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { Camera, ImagePlus, Trash2 } from 'lucide-react-native';
import {
  DEFAULT_UNCERTAINTY_M,
  DEFAULT_REGION,
  LIMITS,
  type CategoryId,
  type LatLng,
  type LocationPrecision,
  createReportSubmissionSchema,
  errorMessageKey,
  formatDateTime,
  getCategory,
  isWithinBBox,
  reportableAlertCategories,
  reportableSubcategories,
  rpcErrorCode,
} from '@tamurt/shared';
import { fontSizes, radii, spacing } from '@tamurt/shared/theme';
import { useTheme } from '@/theme/ThemeProvider';
import { useI18n } from '@/lib/i18n';
import { useOnline } from '@/lib/connectivity';
import { supabase } from '@/lib/supabase';
import { enqueueReport, submitReport } from '@/lib/offlineQueue';
import { type PreparedPhoto, pickPhoto } from '@/lib/photo';
import { observedAtIso, observedPresetMinutes, quarantinePath } from '@/lib/reportLogic';
import { webUrl } from '@/lib/data';
import { Card } from '@/components/Screen';
import { Button, Checkbox, ErrorText, Muted, RadioRow, Subtitle, TextField } from '@/components/ui';
import { CategoryIcon } from '@/components/CategoryIcon';
import { LocationField } from '@/components/LocationField';

type Step = 'category' | 'subcategory' | 'location' | 'details' | 'media' | 'time' | 'review';
const STEPS: Step[] = ['category', 'subcategory', 'location', 'details', 'media', 'time', 'review'];

type Outcome =
  | { kind: 'success'; duplicates: number; photoFailed: boolean }
  | { kind: 'queued'; photoDropped: boolean };

export function ReportWizard({ userId }: { userId: string }) {
  const { colors } = useTheme();
  const { t, tk, locale } = useI18n();
  const online = useOnline();
  const [clientId, setClientId] = useState(() => randomUUID());
  const [step, setStep] = useState<Step>('category');
  const [categoryId, setCategoryId] = useState<CategoryId | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [location, setLocation] = useState<LatLng | null>(null);
  const [precision, setPrecision] = useState<LocationPrecision>('approximate');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);
  const [minutesAgo, setMinutesAgo] = useState(0);
  // Heure de référence figée à l'ouverture de l'étape « Heure » (pas d'horloge pendant le rendu).
  const [timeBase, setTimeBase] = useState(() => Date.now());
  const [certified, setCertified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const category = categoryId ? getCategory(categoryId) : null;
  const stepIndex = STEPS.indexOf(step);
  const uncertainty = DEFAULT_UNCERTAINTY_M[precision];
  const observedAt = observedAtIso(minutesAgo, timeBase);

  const payload = () => ({
    clientId,
    categoryId: categoryId ?? '',
    subcategoryId: subcategoryId ?? '',
    description: description.trim(),
    location: location ?? { lat: NaN, lng: NaN },
    locationPrecision: precision,
    locationUncertaintyM: uncertainty,
    observedAt,
  });

  const issues = (fields: string[]): string[] => {
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
        return Boolean(location) && issues(['locationPrecision']).length === 0;
      case 'details':
        return issues(['description']).length === 0;
      case 'time':
        return issues(['observedAt']).length === 0;
      case 'review':
        return certified;
      default:
        return true;
    }
  };

  const go = (delta: number) => {
    setError(null);
    const next = STEPS[Math.min(Math.max(stepIndex + delta, 0), STEPS.length - 1)];
    if (next === 'time') setTimeBase(Date.now());
    if (next) setStep(next);
  };

  const choosePhoto = async (source: 'camera' | 'library') => {
    setPhotoMessage(null);
    const result = await pickPhoto(source);
    if (result.kind === 'ok') setPhoto(result.photo);
    else if (result.kind === 'denied') setPhotoMessage(t('mobile.permissionDenied'));
    else if (result.kind === 'too_large') setPhotoMessage(t('report.photoTooLarge'));
    else if (result.kind === 'error') setPhotoMessage(t('report.photoType'));
  };

  const submit = async () => {
    setError(null);
    const parsed = createReportSubmissionSchema().safeParse({
      ...payload(),
      observedAt: observedAtIso(minutesAgo, timeBase),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'common.errorGeneric');
      return;
    }
    if (location && !isWithinBBox(location, DEFAULT_REGION.bbox)) {
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
    if (online === false) {
      await enqueueReport({ ...params, queuedAt: new Date().toISOString() });
      setOutcome({ kind: 'queued', photoDropped: Boolean(photo) });
      return;
    }
    setSubmitting(true);
    try {
      const { outcome: result, data } = await submitReport(params);
      if (!result.ok) {
        if (result.network) {
          await enqueueReport({ ...params, queuedAt: new Date().toISOString() });
          setOutcome({ kind: 'queued', photoDropped: Boolean(photo) });
        } else {
          setError(errorMessageKey(rpcErrorCode({ message: result.message })));
        }
        return;
      }
      let photoFailed = false;
      if (photo && data && supabase) {
        const path = quarantinePath(userId, data.report_id, randomUUID());
        const upload = await supabase.storage
          .from('report-media-quarantine')
          .upload(path, photo.bytes, { contentType: 'image/jpeg', upsert: false });
        if (upload.error) {
          photoFailed = true;
        } else {
          const registered = await supabase.rpc('register_report_media', {
            p_report_id: data.report_id,
            p_path: path,
          });
          photoFailed = Boolean(registered.error);
        }
      }
      setOutcome({
        kind: 'success',
        duplicates: data?.possible_duplicates?.length ?? 0,
        photoFailed,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const restart = () => {
    setClientId(randomUUID());
    setStep('category');
    setCategoryId(null);
    setSubcategoryId(null);
    setLocation(null);
    setPrecision('approximate');
    setDescription('');
    setPhoto(null);
    setMinutesAgo(0);
    setCertified(false);
    setOutcome(null);
  };

  if (outcome) {
    return (
      <Card>
        {outcome.kind === 'success' ? (
          <>
            <Subtitle>{t('report.successTitle')}</Subtitle>
            <Text style={[styles.body, { color: colors.text }]}>{t('report.successBody')}</Text>
            {outcome.duplicates > 0 ? <Muted>{t('report.duplicateHint')}</Muted> : null}
            {outcome.photoFailed ? <ErrorText>{t('common.errorGeneric')}</ErrorText> : null}
          </>
        ) : (
          <>
            <Text style={[styles.body, { color: colors.text }]}>{t('report.queuedOffline')}</Text>
            {outcome.photoDropped ? <Muted>{t('mobile.photoNotQueued')}</Muted> : null}
          </>
        )}
        <Button
          variant="outline"
          label={t('report.myReports')}
          onPress={() => router.push('/signalements')}
        />
        <Button label={t('report.newReport')} onPress={restart} />
      </Card>
    );
  }

  const titles: Record<Step, string> = {
    category: t('report.chooseCategory'),
    subcategory: t('report.chooseSubcategory'),
    location: t('report.locationTitle'),
    details: t('report.descriptionLabel'),
    media: t('report.photoLabel'),
    time: t('report.observedAtLabel'),
    review: t('report.reviewTitle'),
  };
  const descriptionIssues =
    step === 'details' && description.length > 0 ? issues(['description']) : [];
  const timeIssues = step === 'time' ? issues(['observedAt']) : [];
  const precisionIssues = step === 'location' ? issues(['locationPrecision']) : [];

  return (
    <View style={styles.container}>
      <View accessibilityLiveRegion="polite">
        <Muted>{t('report.stepOf', { current: stepIndex + 1, total: STEPS.length })}</Muted>
      </View>
      <View
        style={styles.progress}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {STEPS.map((s, i) => (
          <View
            key={s}
            style={[
              styles.progressItem,
              { backgroundColor: i <= stepIndex ? colors.accent : colors.border },
            ]}
          />
        ))}
      </View>

      <Card>
        <Subtitle>{titles[step]}</Subtitle>

        {step === 'category' ? (
          <View accessibilityRole="radiogroup" style={styles.choices}>
            {reportableAlertCategories().map((c) => (
              <RadioRow
                key={c.id}
                label={tk(`category.${c.id}`)}
                selected={categoryId === c.id}
                icon={<CategoryIcon categoryId={c.id} size={24} />}
                onPress={() => {
                  setCategoryId(c.id);
                  setSubcategoryId(null);
                }}
              />
            ))}
            <Muted>{t('report.assistanceRedirect')}</Muted>
            <Button
              variant="ghost"
              label={t('nav.assistance')}
              onPress={() => void Linking.openURL(webUrl('/entraide'))}
            />
          </View>
        ) : null}

        {step === 'subcategory' && categoryId ? (
          <View accessibilityRole="radiogroup" style={styles.choices}>
            {reportableSubcategories(categoryId).map((s) => (
              <RadioRow
                key={s.id}
                label={tk(`subcategory.${s.id}`)}
                selected={subcategoryId === s.id}
                onPress={() => setSubcategoryId(s.id)}
              />
            ))}
          </View>
        ) : null}

        {step === 'location' ? (
          <View style={styles.choices}>
            <Muted>{t('report.locationHelp')}</Muted>
            <LocationField
              value={location}
              uncertaintyM={uncertainty}
              onChange={(p) => setLocation(p)}
              mapLabel={t('report.locationTitle')}
            />
            <Text style={[styles.label, { color: colors.text }]}>{t('report.precision')}</Text>
            <View accessibilityRole="radiogroup" style={styles.choices}>
              {(['exact', 'approximate', 'uncertain'] as const).map((p) => (
                <RadioRow
                  key={p}
                  label={t(
                    p === 'exact'
                      ? 'report.precisionExact'
                      : p === 'approximate'
                        ? 'report.precisionApproximate'
                        : 'report.precisionUncertain',
                  )}
                  selected={precision === p}
                  onPress={() => setPrecision(p)}
                />
              ))}
            </View>
            {precisionIssues.map((m) => (
              <ErrorText key={m}>{tk(m)}</ErrorText>
            ))}
          </View>
        ) : null}

        {step === 'details' ? (
          <View style={styles.choices}>
            <TextField
              label={t('report.descriptionLabel')}
              help={t('report.descriptionHelp')}
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={LIMITS.descriptionMaxLength}
              error={descriptionIssues[0] ? tk(descriptionIssues[0]) : null}
            />
            <Muted>
              {t('report.descriptionCount', {
                count: description.length,
                max: LIMITS.descriptionMaxLength,
              })}
            </Muted>
          </View>
        ) : null}

        {step === 'media' ? (
          <View style={styles.choices}>
            <Muted>{t('report.photoHelp')}</Muted>
            {photo ? (
              <>
                <Image
                  source={{ uri: photo.uri }}
                  style={[styles.preview, { aspectRatio: photo.width / Math.max(photo.height, 1) }]}
                  accessibilityIgnoresInvertColors
                  accessible
                  accessibilityLabel={t('report.photoLabel')}
                />
                <Button
                  variant="outline"
                  label={t('report.photoRemove')}
                  icon={<Trash2 size={18} color={colors.text} />}
                  onPress={() => setPhoto(null)}
                />
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  label={t('mobile.takePhoto')}
                  icon={<Camera size={18} color={colors.text} />}
                  onPress={() => void choosePhoto('camera')}
                />
                <Button
                  variant="outline"
                  label={t('mobile.choosePhoto')}
                  icon={<ImagePlus size={18} color={colors.text} />}
                  onPress={() => void choosePhoto('library')}
                />
              </>
            )}
            {photoMessage ? <ErrorText>{photoMessage}</ErrorText> : null}
            <Muted>{t('report.videoUnavailable')}</Muted>
          </View>
        ) : null}

        {step === 'time' && category ? (
          <View accessibilityRole="radiogroup" style={styles.choices}>
            {observedPresetMinutes(category.validation.maxObservedAgeHours).map((m) => (
              <RadioRow
                key={m}
                label={
                  m === 0
                    ? t('report.observedNow')
                    : m < 60
                      ? t('mobile.observedMinutesAgo', { minutes: m })
                      : t('mobile.observedHoursAgo', { hours: Math.round(m / 60) })
                }
                selected={minutesAgo === m}
                onPress={() => setMinutesAgo(m)}
              />
            ))}
            <Muted>{formatDateTime(observedAt, locale)}</Muted>
            {timeIssues.map((m) => (
              <ErrorText key={m}>{tk(m)}</ErrorText>
            ))}
          </View>
        ) : null}

        {step === 'review' && categoryId && subcategoryId ? (
          <View style={styles.choices}>
            <Text style={[styles.body, { color: colors.text }]}>
              {tk(`category.${categoryId}`)} — {tk(`subcategory.${subcategoryId}`)}
            </Text>
            {location ? (
              <Muted>
                {location.lat.toFixed(5)}, {location.lng.toFixed(5)} ·{' '}
                {t('event.approxRadius', { distance: `${uncertainty} m` })}
              </Muted>
            ) : null}
            <Text style={[styles.body, { color: colors.text }]}>{description.trim()}</Text>
            <Muted>{formatDateTime(observedAt, locale)}</Muted>
            {photo ? <Muted>{t('report.photoLabel')} ✓</Muted> : null}
            <Checkbox label={t('report.certify')} checked={certified} onChange={setCertified} />
          </View>
        ) : null}

        {error ? <ErrorText>{tk(error)}</ErrorText> : null}
      </Card>

      <View style={styles.actions}>
        {stepIndex > 0 ? (
          <Button
            variant="outline"
            label={t('common.previous')}
            onPress={() => go(-1)}
            style={styles.grow}
          />
        ) : null}
        {step === 'review' ? (
          <Button
            label={submitting ? t('report.submitting') : t('report.submit')}
            loading={submitting}
            disabled={!canContinue()}
            onPress={() => void submit()}
            style={styles.grow}
          />
        ) : (
          <Button
            label={t('common.next')}
            disabled={!canContinue()}
            onPress={() => go(1)}
            style={styles.grow}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  progress: { flexDirection: 'row', gap: spacing.xs },
  progressItem: { flex: 1, height: 4, borderRadius: 2 },
  choices: { gap: spacing.sm },
  body: { fontSize: fontSizes.md, lineHeight: 22 },
  label: { fontSize: fontSizes.sm, fontWeight: '600' },
  preview: { width: '100%', borderRadius: radii.md },
  actions: { flexDirection: 'row', gap: spacing.md },
  grow: { flex: 1 },
});
