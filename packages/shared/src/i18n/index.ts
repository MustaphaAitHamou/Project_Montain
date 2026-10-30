import {
  type DictionaryTree,
  type LeafPaths,
  type Locale,
  type Translator,
  createTranslator,
} from './core';
import { fr } from './locales/fr';
import { ar } from './locales/ar';
import { kab } from './locales/kab';

export * from './core';

type PluralSuffix = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';
type StripPlural<K> = K extends `${infer Base}_${PluralSuffix}` ? Base : never;
/** Clés feuilles + clés de base des pluriels (`home.activeCount` pour `_one`/`_other`). */
export type TranslationKey = LeafPaths<typeof fr> | StripPlural<LeafPaths<typeof fr>>;

const DICTIONARIES: Record<Locale, DictionaryTree | undefined> = {
  fr,
  ar,
  kab: kab as DictionaryTree,
};

const cache = new Map<Locale, Translator<TranslationKey>>();

export function getTranslator(locale: Locale): Translator<TranslationKey> {
  let translator = cache.get(locale);
  if (!translator) {
    translator = createTranslator<TranslationKey>(locale, DICTIONARIES, fr);
    cache.set(locale, translator);
  }
  return translator;
}

export { fr, ar, kab };
