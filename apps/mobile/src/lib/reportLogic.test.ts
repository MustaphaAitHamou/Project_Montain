import { describe, expect, it } from 'vitest';
import { observedAtIso, observedPresetMinutes, quarantinePath } from './reportLogic';

describe('assistant de signalement', () => {
  it('limite les heures proposées à l’ancienneté admise par la catégorie', () => {
    expect(observedPresetMinutes(6)).toEqual([0, 15, 30, 60, 180, 360]);
    expect(observedPresetMinutes(24)).toContain(1440);
    expect(observedPresetMinutes(24)).not.toContain(2880);
  });

  it('calcule l’heure observée à partir d’une heure de référence', () => {
    const now = Date.parse('2026-10-30T12:00:00.000Z');
    expect(observedAtIso(0, now)).toBe('2026-10-30T12:00:00.000Z');
    expect(observedAtIso(90, now)).toBe('2026-10-30T10:30:00.000Z');
  });

  it('respecte l’arborescence imposée par la politique de stockage', () => {
    expect(quarantinePath('u1', 'r1', 'f1')).toBe('u1/r1/f1.jpg');
  });
});
