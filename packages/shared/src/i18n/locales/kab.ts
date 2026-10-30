import type { DeepPartialShape } from '../core';
import type { fr } from './fr';

/**
 * Taqbaylit — statut « provisional » : traduction PARTIELLE et NON RELUE.
 * Seuls quelques termes usuels sont proposés ; toutes les autres clés
 * s'affichent en français (repli automatique). Ces termes doivent être relus
 * et complétés par des locuteurs natifs avant d'être considérés comme validés.
 */
export const kab: DeepPartialShape<typeof fr> = {
  nav: {
    villages: 'Tudrin-iw',
  },
  common: {
    cancel: 'Sefsex',
    save: 'Sekles',
    close: 'Mdel',
    back: 'Uɣal',
    search: 'Nadi',
    add: 'Rnu',
    remove: 'Kkes',
    delete: 'Kkes',
    yes: 'Ih',
    no: 'Ala',
    signIn: 'Kcem',
    signOut: 'Ffeɣ',
    language: 'Tutlayt',
  },
  category: {
    fire: 'Times',
    flood: 'Aḥemmal',
    earthquake: 'Azenzla',
  },
  villages: {
    title: 'Tudrin-iw',
    placeType: {
      village: 'Taddart',
      commune: 'Taɣiwant',
    },
  },
  onboarding: {
    welcomeTitle: 'Azul, ansuf ɣer Tamurt Alerte',
  },
};
