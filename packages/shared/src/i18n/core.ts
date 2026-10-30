/**
 * Mini moteur i18n partagé web/mobile, sans dépendance.
 * - Dictionnaires typés (le français est la référence).
 * - Repli sur le français pour toute clé absente (cas du kabyle provisoire).
 * - Interpolation `{nom}` et pluriel simple `{count}` via les clés `_one` / `_other`.
 */

export const LOCALES = ['fr', 'kab', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'fr';

export type ReviewStatus = 'reference' | 'unreviewed' | 'provisional';

export interface LocaleInfo {
  code: Locale;
  /** Nom de la langue dans cette langue. */
  nativeName: string;
  dir: 'ltr' | 'rtl';
  /**
   * reference   : langue source, rédigée par l'équipe.
   * unreviewed  : traduction complète mais pas encore relue par un locuteur natif qualifié.
   * provisional : traduction partielle et provisoire ; les clés manquantes s'affichent en français.
   */
  reviewStatus: ReviewStatus;
}

export const LOCALE_INFO: Record<Locale, LocaleInfo> = {
  fr: { code: 'fr', nativeName: 'Français', dir: 'ltr', reviewStatus: 'reference' },
  kab: { code: 'kab', nativeName: 'Taqbaylit', dir: 'ltr', reviewStatus: 'provisional' },
  ar: { code: 'ar', nativeName: 'العربية', dir: 'rtl', reviewStatus: 'unreviewed' },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Choisit la meilleure langue disponible à partir d'une liste de préférences (ex. Accept-Language). */
export function negotiateLocale(preferences: readonly string[]): Locale {
  for (const pref of preferences) {
    const base = pref.toLowerCase().split(/[-_;]/)[0] ?? '';
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

export type DictionaryTree = { readonly [key: string]: string | DictionaryTree };

/** Même forme que le dictionnaire de référence, valeurs en `string`. */
export type Shape<T> = { readonly [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };
export type DeepPartialShape<T> = {
  readonly [K in keyof T]?: T[K] extends string ? string : DeepPartialShape<T[K]>;
};

type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;
/** Toutes les clés « feuilles » d'un dictionnaire, en notation pointée. */
export type LeafPaths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : Join<K, LeafPaths<T[K]>>;
}[keyof T & string];

export type TranslateParams = Record<string, string | number>;

function lookup(tree: DictionaryTree | undefined, path: string): string | undefined {
  let node: string | DictionaryTree | undefined = tree;
  for (const part of path.split('.')) {
    if (node === undefined || typeof node === 'string') return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

export interface Translator<K extends string> {
  locale: Locale;
  dir: 'ltr' | 'rtl';
  t: (key: K, params?: TranslateParams) => string;
  /** Variante non typée pour les clés construites dynamiquement (ex. `category.${id}`). */
  tk: (key: string, params?: TranslateParams) => string;
  has: (key: string) => boolean;
}

type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

/**
 * Catégorie de pluriel CLDR. Utilise Intl.PluralRules quand il existe ; sinon (certains
 * moteurs JavaScript mobiles), applique les règles simplifiées du français et de l'arabe.
 */
export function pluralCategory(
  locale: Locale,
  count: number,
  intl: { PluralRules?: typeof Intl.PluralRules } = Intl,
): PluralCategory {
  const tag = locale === 'kab' ? 'fr' : locale;
  if (typeof intl.PluralRules === 'function') {
    return new intl.PluralRules(tag).select(count) as PluralCategory;
  }
  const n = Math.abs(count);
  if (tag === 'ar') {
    const mod100 = n % 100;
    if (n === 0) return 'zero';
    if (n === 1) return 'one';
    if (n === 2) return 'two';
    if (Number.isInteger(n) && mod100 >= 3 && mod100 <= 10) return 'few';
    if (Number.isInteger(n) && mod100 >= 11 && mod100 <= 99) return 'many';
    return 'other';
  }
  return n < 2 ? 'one' : 'other';
}

export function createTranslator<K extends string>(
  locale: Locale,
  dictionaries: Record<Locale, DictionaryTree | undefined>,
  fallback: DictionaryTree,
): Translator<K> {
  const primary = dictionaries[locale];

  const resolve = (key: string, params?: TranslateParams): string | undefined => {
    const count = params?.count;
    if (typeof count === 'number') {
      const category = pluralCategory(locale, count);
      const candidates = [`${key}_${category}`, `${key}_other`];
      for (const candidate of candidates) {
        const found = lookup(primary, candidate) ?? lookup(fallback, candidate);
        if (found !== undefined) return found;
      }
    }
    return lookup(primary, key) ?? lookup(fallback, key);
  };

  const tk = (key: string, params?: TranslateParams): string => {
    const template = resolve(key, params);
    return template === undefined ? key : interpolate(template, params);
  };

  return {
    locale,
    dir: LOCALE_INFO[locale].dir,
    t: tk,
    tk,
    has: (key: string) => resolve(key) !== undefined,
  };
}
