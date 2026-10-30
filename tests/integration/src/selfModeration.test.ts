import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, createUser, deleteCreatedUsers, reportParams, type TestUser } from './helpers';

/**
 * Pas d'auto-modération ni d'auto-confirmation : un membre de l'équipe ou un partenaire
 * ne peut pas valider son propre signalement, ni relever le statut d'un événement auquel
 * il a contribué, ni l'appuyer par une vérification.
 */
let moderatorA: TestUser;
let moderatorB: TestUser;
let partner: TestUser;

beforeAll(async () => {
  moderatorA = await createUser('moderateur-a', ['moderator']);
  moderatorB = await createUser('moderateur-b', ['moderator']);
  partner = await createUser('partenaire', ['partner']);
});

afterAll(async () => {
  await deleteCreatedUsers();
  await closeDb();
});

async function submit(user: TestUser) {
  const { data, error } = await user.client.rpc('submit_report', reportParams());
  if (error) throw error;
  return data.report_id as string;
}

const approve = (
  user: TestUser,
  reportId: string,
  status: 'under_review' | 'confirmed' = 'under_review',
) =>
  user.client.rpc('moderate_approve_report', {
    p_report_id: reportId,
    p_mode: 'new_event',
    p_event_id: null,
    p_status: status,
    p_severity: 'vigilance',
  });

describe('pas d’auto-modération', () => {
  it('un modérateur ne peut ni valider ni rejeter son propre signalement', async () => {
    const reportId = await submit(moderatorA);
    expect((await approve(moderatorA, reportId)).error?.message).toContain(
      'self_moderation_forbidden',
    );
    const reject = await moderatorA.client.rpc('moderate_reject_report', {
      p_report_id: reportId,
      p_reason: 'duplicate',
    });
    expect(reject.error?.message).toContain('self_moderation_forbidden');
    // Un autre membre de l'équipe peut le traiter normalement.
    expect((await approve(moderatorB, reportId)).error).toBeNull();
  });

  it('un contributeur ne peut pas confirmer ni appuyer l’événement issu de son signalement', async () => {
    const reportId = await submit(partner);
    const { data: eventId, error } = await approve(moderatorA, reportId);
    expect(error).toBeNull();

    const confirm = await partner.client.rpc('moderate_update_event', {
      p_event_id: eventId as string,
      p_status: 'confirmed',
      p_reason: 'Confirmation par le partenaire',
    });
    expect(confirm.error?.message).toContain('self_moderation_forbidden');

    const support = await partner.client.rpc('add_event_verification', {
      p_event_id: eventId as string,
      p_verdict: 'supports',
    });
    expect(support.error?.message).toContain('self_moderation_forbidden');

    // Un autre modérateur, non contributeur, peut faire évoluer le statut.
    const other = await moderatorB.client.rpc('moderate_update_event', {
      p_event_id: eventId as string,
      p_status: 'corroborated',
      p_reason: 'Recoupé par l’équipe',
    });
    expect(other.error).toBeNull();
  });
});
