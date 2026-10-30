import { describe, expect, it } from 'vitest';
import { circlePolygon, haversineMeters } from './index';

describe('circlePolygon', () => {
  it('produit un anneau fermé dont chaque sommet est au rayon demandé', () => {
    const center = { lat: 36.7118, lng: 4.0459 };
    const polygon = circlePolygon(center, 5000, 32);
    const ring = polygon.coordinates[0] ?? [];
    expect(ring).toHaveLength(33);
    expect(ring[0]).toEqual(ring[32]);
    for (const [lng, lat] of ring) {
      const d = haversineMeters(center, { lat: lat as number, lng: lng as number });
      expect(Math.abs(d - 5000)).toBeLessThan(5);
    }
  });
});
