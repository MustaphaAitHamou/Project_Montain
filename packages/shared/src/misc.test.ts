import { describe, expect, it } from 'vitest';
import { assessFreshness } from './format/freshness';
import { coarsenLocation, formatDistance, haversineMeters, isWithinBBox } from './geo';
import { KABYLIE_REGION } from './config';
import { contrastRatio, severityColors, lightColors, darkColors } from './theme';
import { SEVERITIES } from './domain/severity';
import { CATEGORIES } from './domain/categories';
import { getTranslator, LOCALE_INFO, negotiateLocale, pluralCategory } from './i18n';

describe('géographie', () => {
  it('calcule la distance Tizi Ouzou – Béjaïa (~90 km)', () => {
    const d = haversineMeters({ lat: 36.7118, lng: 4.0459 }, { lat: 36.7509, lng: 5.0567 });
    expect(d).toBeGreaterThan(89000);
    expect(d).toBeLessThan(92000);
  });
  it("vérifie l'appartenance à l'emprise de la Kabylie", () => {
    expect(isWithinBBox({ lat: 36.7118, lng: 4.0459 }, KABYLIE_REGION.bbox)).toBe(true);
    expect(isWithinBBox({ lat: 36.7538, lng: 3.0588 }, KABYLIE_REGION.bbox)).toBe(false); // Alger
  });
  it('dégrade une position pour la diffusion publique', () => {
    expect(coarsenLocation({ lat: 36.71234, lng: 4.04567 })).toEqual({ lat: 36.71, lng: 4.05 });
  });
  it('formate les distances', () => {
    expect(formatDistance(450)).toBe('450 m');
    expect(formatDistance(5000)).toMatch(/^5\s?km$/);
  });
});

describe('fraîcheur des données', () => {
  const now = new Date('2026-07-15T12:00:00Z');
  it('classe les données selon leur âge', () => {
    expect(assessFreshness('2026-07-15T11:55:00Z', now).level).toBe('fresh');
    expect(assessFreshness('2026-07-15T11:30:00Z', now).level).toBe('aging');
    expect(assessFreshness('2026-07-15T10:00:00Z', now)).toEqual({
      level: 'stale',
      ageMinutes: 120,
    });
    expect(assessFreshness(null, now).level).toBe('unknown');
  });
});

describe('accessibilité des couleurs', () => {
  it('garantit un contraste ≥ 4,5:1 pour les badges de gravité', () => {
    for (const severity of SEVERITIES) {
      const { background, text } = severityColors[severity];
      expect(contrastRatio(text, background)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('garantit un contraste ≥ 4,5:1 pour le texte principal des deux thèmes', () => {
    for (const palette of [lightColors, darkColors]) {
      expect(contrastRatio(palette.text, palette.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(palette.textMuted, palette.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(palette.primaryText, palette.primary)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('traductions', () => {
  it('interpole et gère le pluriel', () => {
    const t = getTranslator('fr').t;
    expect(t('home.activeCount', { count: 1 })).toBe('1 événement actif visible');
    expect(t('home.activeCount', { count: 3 })).toBe('3 événements actifs visibles');
  });
  it('accorde le pluriel même sans Intl.PluralRules (moteurs mobiles)', () => {
    const noIntl = {};
    expect(pluralCategory('fr', 0, noIntl)).toBe('one');
    expect(pluralCategory('fr', 1, noIntl)).toBe('one');
    expect(pluralCategory('fr', 2, noIntl)).toBe('other');
    expect(pluralCategory('kab', 5, noIntl)).toBe('other');
    expect(pluralCategory('ar', 0, noIntl)).toBe('zero');
    expect(pluralCategory('ar', 2, noIntl)).toBe('two');
    expect(pluralCategory('ar', 5, noIntl)).toBe('few');
    expect(pluralCategory('ar', 15, noIntl)).toBe('many');
    expect(pluralCategory('ar', 100, noIntl)).toBe('other');
    // Mêmes résultats qu'Intl.PluralRules quand il est disponible.
    for (const n of [0, 1, 2, 5, 15, 100]) {
      expect(pluralCategory('ar', n, noIntl)).toBe(new Intl.PluralRules('ar').select(n));
    }
  });

  it('retombe sur le français pour les clés kabyles absentes', () => {
    const t = getTranslator('kab').t;
    expect(t('common.cancel')).toBe('Sefsex');
    expect(t('home.noAlerts')).toBe(getTranslator('fr').t('home.noAlerts'));
  });
  it('déclare les statuts de relecture et la direction RTL', () => {
    expect(LOCALE_INFO.kab.reviewStatus).toBe('provisional');
    expect(LOCALE_INFO.ar.reviewStatus).toBe('unreviewed');
    expect(getTranslator('ar').dir).toBe('rtl');
  });
  it('traduit chaque catégorie et sous-catégorie en français et en arabe', () => {
    for (const locale of ['fr', 'ar'] as const) {
      const { has } = getTranslator(locale);
      for (const category of CATEGORIES) {
        expect(has(`category.${category.id}`)).toBe(true);
        for (const sub of category.subcategories) {
          expect(has(`subcategory.${sub.id}`)).toBe(true);
        }
      }
    }
  });
  it('négocie la langue', () => {
    expect(negotiateLocale(['ar-DZ', 'fr'])).toBe('ar');
    expect(negotiateLocale(['en-US'])).toBe('fr');
  });
  it('utilise le texte prudent quand aucune alerte n’est présente', () => {
    expect(getTranslator('fr').t('home.noAlerts')).toBe(
      'Aucune alerte signalée dans les sources actuellement disponibles.',
    );
  });
});
