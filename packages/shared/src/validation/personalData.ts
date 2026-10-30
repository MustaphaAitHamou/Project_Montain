/**
 * Détection simple de coordonnées personnelles dans un texte libre public.
 * Objectif : éviter qu'un numéro de téléphone ou une adresse e-mail soit publié
 * par erreur dans un signalement ou une annonce d'entraide. Ce filtre est
 * volontairement prudent (faux positifs possibles) et complété par la modération.
 */
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

/** Suite de 9 chiffres ou plus, éventuellement séparés par espaces, points ou tirets. */
const LONG_DIGIT_SEQUENCE_RE = /(?:\+?\d[\s.-]?){9,}/;

export function containsEmail(text: string): boolean {
  return EMAIL_RE.test(text);
}

export function containsPhoneNumber(text: string): boolean {
  const match = text.match(LONG_DIGIT_SEQUENCE_RE);
  if (!match) return false;
  const digits = match[0].replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 15;
}

export function containsPersonalContact(text: string): boolean {
  return containsEmail(text) || containsPhoneNumber(text);
}
