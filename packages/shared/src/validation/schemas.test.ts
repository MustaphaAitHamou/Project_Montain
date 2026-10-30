import { describe, expect, it } from 'vitest';
import {
  assistancePostSchema,
  createReportSubmissionSchema,
  followedPlaceInputSchema,
  notificationPreferencesSchema,
  DEFAULT_NOTIFICATION_PREFERENCES,
  signUpSchema,
} from './schemas';
import { containsPersonalContact } from './personalData';

const NOW = new Date('2026-07-15T12:00:00Z');
const schema = createReportSubmissionSchema(() => NOW);

function validReport(overrides: Record<string, unknown> = {}) {
  return {
    clientId: '6f1d3a3e-8f7c-4c1a-9f0e-0d3c2b1a4e5f',
    categoryId: 'fire',
    subcategoryId: 'fire.smoke',
    description: 'Fumée visible au-dessus de la forêt, côté nord.',
    location: { lat: 36.62, lng: 4.21 },
    locationPrecision: 'uncertain',
    locationUncertaintyM: 2000,
    observedAt: '2026-07-15T11:40:00Z',
    ...overrides,
  };
}

function issues(input: unknown): string[] {
  const result = schema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.message);
}

describe('schéma de signalement', () => {
  it('accepte un signalement valide avec localisation incertaine', () => {
    expect(schema.safeParse(validReport()).success).toBe(true);
  });

  it('refuse une sous-catégorie réservée (incendie confirmé)', () => {
    expect(issues(validReport({ subcategoryId: 'fire.confirmed' }))).toContain(
      'validation.subcategory_invalid',
    );
  });

  it("refuse une sous-catégorie d'une autre catégorie", () => {
    expect(issues(validReport({ subcategoryId: 'flood.overflow' }))).toContain(
      'validation.subcategory_invalid',
    );
  });

  it("refuse l'entraide dans le formulaire d'alerte", () => {
    expect(
      issues(validReport({ categoryId: 'mutual_aid', subcategoryId: 'mutual_aid.logistics' })),
    ).toContain('validation.category_not_reportable');
  });

  it('refuse les coordonnées personnelles dans la description', () => {
    expect(issues(validReport({ description: 'Appelez-moi au 0555 12 34 56 svp' }))).toContain(
      'validation.no_personal_contact',
    );
  });

  it("refuse une heure d'observation dans le futur ou trop ancienne", () => {
    expect(issues(validReport({ observedAt: '2026-07-15T13:00:00Z' }))).toContain(
      'validation.observed_in_future',
    );
    expect(issues(validReport({ observedAt: '2026-07-13T11:00:00Z' }))).toContain(
      'validation.observed_too_old',
    );
  });

  it('exige une localisation au moins approximative pour la circulation', () => {
    expect(
      issues(
        validReport({
          categoryId: 'traffic',
          subcategoryId: 'traffic.road_closed',
          description: 'Route fermée après un éboulement.',
        }),
      ),
    ).toContain('validation.location_must_be_precise');
  });

  it('refuse une description trop courte', () => {
    expect(issues(validReport({ description: 'feu' }))).toContain(
      'validation.description_too_short',
    );
  });
});

describe('schéma des lieux suivis', () => {
  it('exige le code commune pour un lieu de type commune', () => {
    const r = followedPlaceInputSchema.safeParse({
      label: 'Ma commune',
      placeType: 'commune',
      location: { lat: 36.6, lng: 4.2 },
      radiusM: 5000,
    });
    expect(r.success).toBe(false);
  });
  it('accepte un lieu personnalisé et applique les valeurs par défaut', () => {
    const r = followedPlaceInputSchema.parse({
      label: 'Village de mes parents',
      placeType: 'custom',
      location: { lat: 36.6, lng: 4.2 },
      radiusM: 2000,
    });
    expect(r.categories).toEqual([]);
    expect(r.notify).toBe(true);
  });
  it('borne le rayon de surveillance', () => {
    const r = followedPlaceInputSchema.safeParse({
      label: 'x',
      placeType: 'custom',
      location: { lat: 36.6, lng: 4.2 },
      radiusM: 100000,
    });
    expect(r.success).toBe(false);
  });
});

describe('autres schémas', () => {
  it('valide les préférences par défaut', () => {
    expect(notificationPreferencesSchema.safeParse(DEFAULT_NOTIFICATION_PREFERENCES).success).toBe(
      true,
    );
  });
  it("n'exige pas de numéro de téléphone à l'inscription", () => {
    const r = signUpSchema.safeParse({
      email: 'test@example.org',
      password: 'motdepasse42',
      acceptTerms: true,
    });
    expect(r.success).toBe(true);
  });
  it('refuse un mot de passe sans chiffre', () => {
    const r = signUpSchema.safeParse({
      email: 'test@example.org',
      password: 'motdepasselong',
      acceptTerms: true,
    });
    expect(r.success).toBe(false);
  });
  it("refuse une annonce d'entraide contenant un e-mail", () => {
    const r = assistancePostSchema.safeParse({
      kind: 'need',
      title: 'Besoin de couvertures',
      description: 'Écrivez à quelqu.un@example.org pour organiser la livraison.',
      communeCode: '1501',
      expiresInDays: 7,
    });
    expect(r.success).toBe(false);
  });
});

describe('détection de coordonnées personnelles', () => {
  it('détecte les numéros et e-mails', () => {
    expect(containsPersonalContact('+213 555 12 34 56')).toBe(true);
    expect(containsPersonalContact('contact@exemple.dz')).toBe(true);
  });
  it('ignore les nombres courts (heures, magnitudes, routes)', () => {
    expect(containsPersonalContact('RN12 fermée vers 14h30, km 25')).toBe(false);
  });
});
