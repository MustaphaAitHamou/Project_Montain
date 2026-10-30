import { describe, expect, it } from 'vitest';
import type { QueuedReport } from '@tamurt/shared';
import { isNetworkErrorMessage, shouldDequeue, upsertQueued } from './queueLogic';

const item = (clientId: string, description = 'Fumée visible au loin'): QueuedReport => ({
  p_client_id: clientId,
  p_category_id: 'fire',
  p_subcategory_id: 'fire.smoke',
  p_description: description,
  p_lat: 36.7,
  p_lng: 4.05,
  p_location_precision: 'approximate',
  p_location_uncertainty_m: 500,
  p_observed_at: '2026-10-30T10:00:00.000Z',
  queuedAt: '2026-10-30T10:01:00.000Z',
});

describe('file hors ligne', () => {
  it('ne garde qu’un exemplaire par identifiant client (pas de doublon au renvoi)', () => {
    const queue = upsertQueued(upsertQueued([], item('a')), item('b'));
    const updated = upsertQueued(queue, item('a', 'Description corrigée'));
    expect(updated.map((r) => r.p_client_id)).toEqual(['b', 'a']);
    expect(updated.find((r) => r.p_client_id === 'a')?.p_description).toBe('Description corrigée');
  });

  it('retire les envois acceptés et les refus définitifs, garde les erreurs temporaires', () => {
    expect(shouldDequeue({ ok: true })).toBe(true);
    expect(
      shouldDequeue({ ok: false, message: 'outside_coverage: hors zone', network: false }),
    ).toBe(true);
    expect(
      shouldDequeue({ ok: false, message: 'personal_contact_not_allowed', network: false }),
    ).toBe(true);
    expect(shouldDequeue({ ok: false, message: 'rate_limited', network: false })).toBe(false);
    expect(shouldDequeue({ ok: false, message: 'Network request failed', network: true })).toBe(
      false,
    );
  });

  it('reconnaît les erreurs de transport', () => {
    expect(isNetworkErrorMessage('TypeError: Network request failed')).toBe(true);
    expect(isNetworkErrorMessage('rate_limited')).toBe(false);
  });
});
