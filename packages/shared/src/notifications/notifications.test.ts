import { describe, expect, it } from 'vitest';
import {
  buildDedupKey,
  decideDelivery,
  isWithinQuietHours,
  notificationReasonFor,
  type RecipientPreferences,
} from './index';

const prefs: RecipientPreferences = {
  pushEnabled: true,
  minSeverity: 'vigilance',
  includeUnverified: false,
  updatesEnabled: true,
  resolutionEnabled: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  timezone: 'Africa/Algiers',
};
const allPlaces = { categories: [], minSeverity: null, notify: true };
const NOON = new Date('2026-07-15T11:00:00Z'); // 12:00 à Alger (UTC+1)

describe('heures silencieuses', () => {
  it('gère une plage qui passe minuit (fuseau Africa/Algiers)', () => {
    expect(
      isWithinQuietHours(new Date('2026-07-15T22:30:00Z'), '22:00', '07:00', 'Africa/Algiers'),
    ).toBe(true); // 23:30
    expect(
      isWithinQuietHours(new Date('2026-07-15T05:30:00Z'), '22:00', '07:00', 'Africa/Algiers'),
    ).toBe(true); // 06:30
    expect(
      isWithinQuietHours(new Date('2026-07-15T06:30:00Z'), '22:00', '07:00', 'Africa/Algiers'),
    ).toBe(false); // 07:30
  });
  it('gère une plage diurne', () => {
    expect(isWithinQuietHours(NOON, '11:00', '14:00', 'Africa/Algiers')).toBe(true);
    expect(isWithinQuietHours(NOON, '13:00', '14:00', 'Africa/Algiers')).toBe(false);
  });
});

describe('raison de notification', () => {
  it('notifie à la publication', () => {
    expect(
      notificationReasonFor(null, {
        status: 'under_review',
        severity: 'vigilance',
        isPublic: true,
      }),
    ).toBe('published');
  });
  it('notifie une confirmation et une fin d’incident', () => {
    const before = {
      status: 'under_review' as const,
      severity: 'vigilance' as const,
      isPublic: true,
    };
    expect(notificationReasonFor(before, { ...before, status: 'confirmed' })).toBe(
      'status_upgraded',
    );
    expect(notificationReasonFor(before, { ...before, status: 'resolved' })).toBe('resolved');
  });
  it('ne notifie pas un événement rejeté ou non public', () => {
    expect(
      notificationReasonFor(null, { status: 'rejected', severity: 'critical', isPublic: true }),
    ).toBeNull();
    expect(
      notificationReasonFor(null, { status: 'confirmed', severity: 'critical', isPublic: false }),
    ).toBeNull();
  });
  it('construit une clé de déduplication stable', () => {
    expect(buildDedupKey('e1', 'published', 1)).toBe('e1:published:1');
  });
});

describe('décision de remise', () => {
  it('envoie un push pour un incendie en vérification si l’utilisateur accepte le non vérifié', () => {
    const d = decideDelivery(
      { categoryId: 'fire', status: 'under_review', severity: 'vigilance', reason: 'published' },
      { ...prefs, includeUnverified: true },
      allPlaces,
      NOON,
    );
    expect(d).toEqual({ notify: true, channel: 'push', why: 'ok' });
  });

  it('exclut le non vérifié par défaut', () => {
    const d = decideDelivery(
      { categoryId: 'fire', status: 'under_review', severity: 'vigilance', reason: 'published' },
      prefs,
      allPlaces,
      NOON,
    );
    expect(d.notify).toBe(false);
  });

  it('respecte la gravité minimale', () => {
    const d = decideDelivery(
      {
        categoryId: 'utilities',
        status: 'confirmed',
        severity: 'information',
        reason: 'published',
      },
      prefs,
      allPlaces,
      NOON,
    );
    expect(d).toMatchObject({ notify: false, why: 'below_min_severity' });
  });

  it('respecte les catégories suivies par lieu', () => {
    const d = decideDelivery(
      { categoryId: 'traffic', status: 'confirmed', severity: 'important', reason: 'published' },
      prefs,
      { categories: ['fire'], minSeverity: null, notify: true },
      NOON,
    );
    expect(d).toMatchObject({ notify: false, why: 'category_not_followed' });
  });

  it('retient le push non critique pendant les heures silencieuses (boîte de réception seulement)', () => {
    const night = new Date('2026-07-15T23:30:00Z');
    const quiet = { ...prefs, quietHoursEnabled: true };
    const important = decideDelivery(
      { categoryId: 'fire', status: 'confirmed', severity: 'important', reason: 'published' },
      quiet,
      allPlaces,
      night,
    );
    expect(important).toMatchObject({ notify: true, channel: 'inbox_only', why: 'quiet_hours' });
    const critical = decideDelivery(
      { categoryId: 'fire', status: 'confirmed', severity: 'critical', reason: 'published' },
      quiet,
      allPlaces,
      night,
    );
    expect(critical).toMatchObject({ notify: true, channel: 'push' });
  });

  it("ne pousse jamais l'entraide", () => {
    const d = decideDelivery(
      { categoryId: 'mutual_aid', status: 'confirmed', severity: 'important', reason: 'published' },
      prefs,
      allPlaces,
      NOON,
    );
    expect(d).toMatchObject({ notify: false, why: 'category_not_notifiable' });
  });

  it('laisse passer les fins d’incident si activées', () => {
    const d = decideDelivery(
      { categoryId: 'fire', status: 'resolved', severity: 'information', reason: 'resolved' },
      prefs,
      allPlaces,
      NOON,
    );
    expect(d).toMatchObject({ notify: true, channel: 'push' });
    const off = decideDelivery(
      { categoryId: 'fire', status: 'resolved', severity: 'information', reason: 'resolved' },
      { ...prefs, resolutionEnabled: false },
      allPlaces,
      NOON,
    );
    expect(off.notify).toBe(false);
  });

  it("n'envoie pas de push pour un séisme non confirmé (règle de catégorie)", () => {
    const d = decideDelivery(
      {
        categoryId: 'earthquake',
        status: 'corroborated',
        severity: 'important',
        reason: 'published',
      },
      prefs,
      allPlaces,
      NOON,
    );
    expect(d).toMatchObject({ notify: true, channel: 'inbox_only' });
  });
});
