import { describe, expect, it } from 'vitest';
import {
  CATEGORIES,
  CATEGORY_IDS,
  findSubcategory,
  reportableAlertCategories,
  reportableSubcategories,
} from './categories';
import {
  canTransition,
  capSeverity,
  maxSeverityForStatus,
  VERIFICATION_STATUSES,
} from './statuses';
import { isAtLeast, severityRank } from './severity';
import { displayClassFor } from './sources';
import { can } from './roles';

describe('catalogue des catégories', () => {
  it('contient les 8 catégories attendues avec des identifiants uniques', () => {
    expect(CATEGORIES.map((c) => c.id)).toEqual([...CATEGORY_IDS]);
    const subIds = CATEGORIES.flatMap((c) => c.subcategories.map((s) => s.id));
    expect(new Set(subIds).size).toBe(subIds.length);
  });

  it('préfixe chaque sous-catégorie par sa catégorie', () => {
    for (const category of CATEGORIES) {
      for (const sub of category.subcategories) {
        expect(sub.id.startsWith(`${category.id}.`)).toBe(true);
        expect(sub.categoryId).toBe(category.id);
      }
    }
  });

  it('ne permet pas à un utilisateur de déclarer un incendie confirmé ou terminé', () => {
    expect(findSubcategory('fire.confirmed')?.reportable).toBe(false);
    expect(findSubcategory('fire.ended')?.reportable).toBe(false);
    expect(reportableSubcategories('fire').map((s) => s.id)).not.toContain('fire.confirmed');
  });

  it("exclut l'entraide du formulaire d'alerte", () => {
    expect(reportableAlertCategories().map((c) => c.id)).not.toContain('mutual_aid');
  });
});

describe('gravité et statuts', () => {
  it('ordonne les gravités', () => {
    expect(severityRank('information')).toBeLessThan(severityRank('critical'));
    expect(isAtLeast('important', 'vigilance')).toBe(true);
    expect(isAtLeast('information', 'vigilance')).toBe(false);
  });

  it("plafonne la gravité d'une information non vérifiée à « vigilance »", () => {
    expect(capSeverity('critical', 'received')).toBe('vigilance');
    expect(capSeverity('critical', 'under_review')).toBe('vigilance');
    expect(capSeverity('critical', 'corroborated')).toBe('important');
    expect(capSeverity('critical', 'confirmed')).toBe('critical');
    expect(capSeverity('information', 'received')).toBe('information');
  });

  it('définit un plafond pour chaque statut', () => {
    for (const status of VERIFICATION_STATUSES) {
      expect(maxSeverityForStatus(status)).toBeDefined();
    }
  });

  it('contrôle les transitions de statut', () => {
    expect(canTransition('received', 'confirmed')).toBe(true);
    expect(canTransition('archived', 'confirmed')).toBe(false);
    expect(canTransition('confirmed', 'received')).toBe(false);
  });
});

describe("classes d'affichage", () => {
  it('ne présente jamais un point chaud satellite comme confirmé', () => {
    expect(displayClassFor('satellite', 'confirmed')).toBe('satellite');
  });
  it('distingue les informations non vérifiées', () => {
    expect(displayClassFor('community', 'under_review')).toBe('unverified');
    expect(displayClassFor('community', 'corroborated')).toBe('community');
    expect(displayClassFor('seismic', 'confirmed')).toBe('institutional');
  });
});

describe('permissions (confort UI uniquement)', () => {
  it('limite le visiteur à la consultation', () => {
    expect(can({ kind: 'visitor' }, 'alerts.read_public')).toBe(true);
    expect(can({ kind: 'visitor' }, 'report.create')).toBe(false);
  });
  it("n'accorde pas la modération à un contributeur fiable", () => {
    const actor = { kind: 'user' as const, userId: 'u', roles: ['trusted_contributor' as const] };
    expect(can(actor, 'event.add_verification')).toBe(true);
    expect(can(actor, 'report.moderate')).toBe(false);
  });
  it('réserve la gestion des rôles aux administrateurs', () => {
    expect(can({ kind: 'user', userId: 'u', roles: ['moderator'] }, 'roles.manage')).toBe(false);
    expect(can({ kind: 'user', userId: 'u', roles: ['admin'] }, 'roles.manage')).toBe(true);
  });
});
