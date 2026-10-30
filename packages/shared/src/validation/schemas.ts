import { z } from 'zod';
import { CATEGORY_IDS, findSubcategory, getCategory } from '../domain/categories';
import { REJECTION_REASONS, VERIFICATION_STATUSES } from '../domain/statuses';
import { SEVERITIES } from '../domain/severity';
import { APP_ROLES } from '../domain/roles';
import { LIMITS } from '../config';
import { WATCH_RADIUS_MAX_M, WATCH_RADIUS_MIN_M } from '../geo';
import { containsPersonalContact } from './personalData';

/**
 * Les messages d'erreur sont des clés de traduction (voir i18n `validation.*`),
 * pour être affichés dans la langue de l'utilisateur.
 */

export const latLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const LOCATION_PRECISIONS = ['exact', 'approximate', 'uncertain'] as const;
export type LocationPrecision = (typeof LOCATION_PRECISIONS)[number];

/** Incertitude par défaut (mètres) selon la précision déclarée. */
export const DEFAULT_UNCERTAINTY_M: Record<LocationPrecision, number> = {
  exact: 50,
  approximate: 500,
  uncertain: 2000,
};

const OBSERVED_AT_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export function createReportSubmissionSchema(now: () => Date = () => new Date()) {
  return z
    .object({
      /** Clé d'idempotence générée par le client (file hors ligne, double clic). */
      clientId: z.uuid(),
      categoryId: z.enum(CATEGORY_IDS),
      subcategoryId: z.string().min(3).max(64),
      description: z
        .string()
        .trim()
        .max(LIMITS.descriptionMaxLength, { error: 'validation.description_too_long' }),
      /** Position du PHÉNOMÈNE (pas nécessairement celle du téléphone). */
      location: latLngSchema,
      locationPrecision: z.enum(LOCATION_PRECISIONS),
      locationUncertaintyM: z.number().int().min(0).max(20000).nullable().optional(),
      observedAt: z.iso.datetime({ offset: true }),
    })
    .superRefine((value, ctx) => {
      const category = getCategory(value.categoryId);
      const subcategory = findSubcategory(value.subcategoryId);
      if (category.module !== 'alerts') {
        ctx.addIssue({
          code: 'custom',
          path: ['categoryId'],
          message: 'validation.category_not_reportable',
        });
      }
      if (!subcategory || subcategory.categoryId !== value.categoryId || !subcategory.reportable) {
        ctx.addIssue({
          code: 'custom',
          path: ['subcategoryId'],
          message: 'validation.subcategory_invalid',
        });
      }
      if (value.description.length < category.validation.minDescriptionLength) {
        ctx.addIssue({
          code: 'custom',
          path: ['description'],
          message: 'validation.description_too_short',
        });
      }
      if (containsPersonalContact(value.description)) {
        ctx.addIssue({
          code: 'custom',
          path: ['description'],
          message: 'validation.no_personal_contact',
        });
      }
      if (value.locationPrecision === 'uncertain' && !category.validation.allowUncertainLocation) {
        ctx.addIssue({
          code: 'custom',
          path: ['locationPrecision'],
          message: 'validation.location_must_be_precise',
        });
      }
      const observed = Date.parse(value.observedAt);
      const current = now().getTime();
      if (observed > current + OBSERVED_AT_FUTURE_TOLERANCE_MS) {
        ctx.addIssue({
          code: 'custom',
          path: ['observedAt'],
          message: 'validation.observed_in_future',
        });
      }
      if (observed < current - category.validation.maxObservedAgeHours * 3600 * 1000) {
        ctx.addIssue({
          code: 'custom',
          path: ['observedAt'],
          message: 'validation.observed_too_old',
        });
      }
    });
}

export const reportSubmissionSchema = createReportSubmissionSchema();
export type ReportSubmission = z.infer<typeof reportSubmissionSchema>;

export const FOLLOWED_PLACE_TYPES = ['commune', 'village', 'custom'] as const;
export type FollowedPlaceType = (typeof FOLLOWED_PLACE_TYPES)[number];

export const followedPlaceInputSchema = z
  .object({
    label: z.string().trim().min(1).max(60),
    placeType: z.enum(FOLLOWED_PLACE_TYPES),
    communeCode: z
      .string()
      .regex(/^\d{4}$/)
      .nullable()
      .optional(),
    villageId: z.uuid().nullable().optional(),
    location: latLngSchema,
    radiusM: z.number().int().min(WATCH_RADIUS_MIN_M).max(WATCH_RADIUS_MAX_M),
    /** Liste vide = toutes les catégories. */
    categories: z.array(z.enum(CATEGORY_IDS)).max(CATEGORY_IDS.length).default([]),
    notify: z.boolean().default(true),
    minSeverity: z.enum(SEVERITIES).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.placeType === 'commune' && !value.communeCode) {
      ctx.addIssue({ code: 'custom', path: ['communeCode'], message: 'validation.required' });
    }
    if (value.placeType === 'village' && !value.villageId) {
      ctx.addIssue({ code: 'custom', path: ['villageId'], message: 'validation.required' });
    }
  });
export type FollowedPlaceInput = z.infer<typeof followedPlaceInputSchema>;

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: 'validation.time_format' });

export const notificationPreferencesSchema = z.object({
  pushEnabled: z.boolean(),
  webPushEnabled: z.boolean(),
  minSeverity: z.enum(SEVERITIES),
  /** Recevoir aussi les informations non encore vérifiées (plafonnées à « vigilance »). */
  includeUnverified: z.boolean(),
  updatesEnabled: z.boolean(),
  resolutionEnabled: z.boolean(),
  quietHoursEnabled: z.boolean(),
  quietHoursStart: hhmm,
  quietHoursEnd: hhmm,
  timezone: z.string().min(1).max(64),
});
export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferencesInput = {
  pushEnabled: true,
  webPushEnabled: false,
  minSeverity: 'vigilance',
  includeUnverified: false,
  updatesEnabled: true,
  resolutionEnabled: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  timezone: 'Africa/Algiers',
};

const passwordSchema = z
  .string()
  .min(10, { error: 'validation.password_too_short' })
  .max(128)
  .regex(/[A-Za-z]/, { error: 'validation.password_letters_digits' })
  .regex(/\d/, { error: 'validation.password_letters_digits' });

export const signUpSchema = z.object({
  email: z.email({ error: 'validation.email_invalid' }),
  password: passwordSchema,
  displayName: z.string().trim().min(2).max(40).optional(),
  acceptTerms: z.literal(true, { error: 'validation.accept_terms' }),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z.email({ error: 'validation.email_invalid' }),
  password: z.string().min(1, { error: 'validation.required' }),
});

export const passwordResetRequestSchema = z.object({
  email: z.email({ error: 'validation.email_invalid' }),
});

export const newPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    error: 'validation.passwords_mismatch',
  });

export const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(2).max(40).nullable(),
  preferredLocale: z.enum(['fr', 'kab', 'ar']),
});

export const ASSISTANCE_KINDS = ['need', 'offer', 'volunteers', 'distribution'] as const;
export type AssistanceKind = (typeof ASSISTANCE_KINDS)[number];

export const assistancePostSchema = z
  .object({
    kind: z.enum(ASSISTANCE_KINDS),
    title: z.string().trim().min(5).max(80),
    description: z.string().trim().min(20).max(1000),
    communeCode: z.string().regex(/^\d{4}$/),
    expiresInDays: z.number().int().min(1).max(30),
  })
  .superRefine((value, ctx) => {
    for (const field of ['title', 'description'] as const) {
      if (containsPersonalContact(value[field])) {
        ctx.addIssue({ code: 'custom', path: [field], message: 'validation.no_personal_contact' });
      }
    }
  });
export type AssistancePostInput = z.infer<typeof assistancePostSchema>;

export const ABUSE_TARGET_TYPES = ['event', 'report', 'assistance'] as const;
export const ABUSE_REASONS = [
  'false_information',
  'personal_data',
  'hateful_or_violent',
  'spam',
  'inappropriate_media',
  'other',
] as const;

export const abuseReportSchema = z.object({
  targetType: z.enum(ABUSE_TARGET_TYPES),
  targetId: z.uuid(),
  reason: z.enum(ABUSE_REASONS),
  details: z.string().trim().max(500).optional(),
});

export const appealSchema = z.object({
  reportId: z.uuid(),
  message: z.string().trim().min(10).max(1000),
});

/** Actions de modération (validées par les routes serveur ET par les fonctions SQL). */
export const approveReportSchema = z
  .object({
    reportId: z.uuid(),
    mode: z.enum(['new_event', 'attach']),
    eventId: z.uuid().optional(),
    status: z.enum(['under_review', 'corroborated', 'confirmed']),
    severity: z.enum(SEVERITIES),
    publicNote: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.mode === 'new_event' || Boolean(v.eventId), {
    path: ['eventId'],
    error: 'validation.required',
  });

export const rejectReportSchema = z.object({
  reportId: z.uuid(),
  reason: z.enum(REJECTION_REASONS),
  note: z.string().trim().max(500).optional(),
});

export const updateEventSchema = z.object({
  eventId: z.uuid(),
  status: z.enum(VERIFICATION_STATUSES).optional(),
  severity: z.enum(SEVERITIES).optional(),
  publicNote: z.string().trim().max(500).optional(),
  /** Justification obligatoire, conservée dans l'historique. */
  reason: z.string().trim().min(3).max(500),
});

export const roleChangeSchema = z.object({
  userId: z.uuid(),
  role: z.enum(APP_ROLES),
  action: z.enum(['grant', 'revoke']),
  organization: z.string().trim().max(120).optional(),
  reason: z.string().trim().min(3).max(500),
});
