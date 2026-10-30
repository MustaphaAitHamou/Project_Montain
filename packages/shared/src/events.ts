import type { Database } from './database.types';
import type { Locale } from './i18n/core';
import type { CategoryId } from './domain/categories';
import type { Severity } from './domain/severity';
import type { SourceKind } from './domain/sources';
import { type VerificationStatus, ACTIVE_STATUSES } from './domain/statuses';

export type EventFeedRow = Database['public']['Views']['event_feed']['Row'];

/** Événement normalisé pour l'affichage (colonnes de vue rendues non nulles). */
export interface EventView {
  id: string;
  categoryId: CategoryId;
  subcategoryId: string;
  status: VerificationStatus;
  severity: Severity;
  sourceKind: SourceKind;
  isDemo: boolean;
  lat: number;
  lng: number;
  uncertaintyM: number;
  communeCode: string | null;
  communeNameFr: string | null;
  communeNameAr: string | null;
  wilayaNameFr: string | null;
  wilayaNameAr: string | null;
  publicNote: string | null;
  startedAt: string;
  endedAt: string | null;
  lastActivityAt: string;
  reportCount: number;
  externalUrl: string | null;
  externalSourceId: string | null;
  magnitude: number | null;
  depthKm: number | null;
  updatedAt: string;
}

export function toEventView(row: EventFeedRow): EventView | null {
  if (!row.id || !row.category_id || !row.subcategory_id || !row.status || !row.severity)
    return null;
  if (row.lat === null || row.lng === null) return null;
  return {
    id: row.id,
    categoryId: row.category_id as CategoryId,
    subcategoryId: row.subcategory_id,
    status: row.status,
    severity: row.severity,
    sourceKind: (row.source_kind ?? 'community') as SourceKind,
    isDemo: Boolean(row.is_demo),
    lat: row.lat,
    lng: row.lng,
    uncertaintyM: row.location_uncertainty_m ?? 0,
    communeCode: row.commune_code,
    communeNameFr: row.commune_name_fr,
    communeNameAr: row.commune_name_ar,
    wilayaNameFr: row.wilaya_name_fr,
    wilayaNameAr: row.wilaya_name_ar,
    publicNote: row.public_note,
    startedAt: row.started_at ?? row.created_at ?? new Date(0).toISOString(),
    endedAt: row.ended_at,
    lastActivityAt: row.last_activity_at ?? row.updated_at ?? new Date(0).toISOString(),
    reportCount: row.report_count ?? 0,
    externalUrl: row.external_url,
    externalSourceId: row.external_source_id,
    magnitude: row.magnitude,
    depthKm: row.depth_km,
    updatedAt: row.updated_at ?? new Date(0).toISOString(),
  };
}

export function eventTitle(
  event: Pick<EventView, 'subcategoryId'>,
  tk: (key: string) => string,
): string {
  return tk(`subcategory.${event.subcategoryId}`);
}

export function placeLabel(
  event: Pick<EventView, 'communeNameFr' | 'communeNameAr' | 'wilayaNameFr' | 'wilayaNameAr'>,
  locale: Locale,
): string {
  const commune =
    locale === 'ar' ? (event.communeNameAr ?? event.communeNameFr) : event.communeNameFr;
  const wilaya = locale === 'ar' ? (event.wilayaNameAr ?? event.wilayaNameFr) : event.wilayaNameFr;
  return [commune, wilaya].filter(Boolean).join(locale === 'ar' ? '، ' : ', ');
}

export function isActive(status: VerificationStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}
