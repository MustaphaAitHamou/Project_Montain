import { DEFAULT_TIMEZONE } from '../config';

const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: 'second' },
  { amount: 60, unit: 'minute' },
  { amount: 24, unit: 'hour' },
  { amount: 7, unit: 'day' },
  { amount: 4.34524, unit: 'week' },
  { amount: 12, unit: 'month' },
  { amount: Number.POSITIVE_INFINITY, unit: 'year' },
];

/** « il y a 5 minutes », « منذ 5 دقائق »… via Intl (disponible web et Hermes). */
export function formatRelativeTime(
  date: Date | string,
  locale: string,
  now: Date = new Date(),
): string {
  const time = typeof date === 'string' ? new Date(date) : date;
  // Certains moteurs JavaScript mobiles n'implémentent pas RelativeTimeFormat : date absolue.
  if (typeof Intl.RelativeTimeFormat !== 'function') return formatDateTime(time, locale);
  let duration = (time.getTime() - now.getTime()) / 1000;
  const formatter = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: 'auto' });
  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return formatter.format(Math.round(duration), 'year');
}

export function formatDateTime(
  date: Date | string,
  locale: string,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  const time = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(time);
}

export function formatUtc(date: Date | string): string {
  const time = typeof date === 'string' ? new Date(date) : date;
  return `${time.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

/**
 * Le kabyle n'est pas toujours pris en charge par les données CLDR des moteurs JS :
 * on retombe sur le français pour les formats de dates et de nombres.
 */
export function intlLocale(locale: string): string {
  if (locale === 'kab') return 'fr-DZ';
  if (locale === 'ar') return 'ar-DZ';
  return 'fr-FR';
}
