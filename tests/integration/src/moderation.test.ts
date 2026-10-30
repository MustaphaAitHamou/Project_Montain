import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  anonClient,
  closeDb,
  createUser,
  db,
  deleteCreatedUsers,
  reportParams,
  setSetting,
  type TestUser,
} from './helpers';

let author: TestUser;
// Second auteur : la limite serveur est de 5 signalements par heure et par compte.
let author2: TestUser;
let moderator: TestUser;
let admin: TestUser;
let trusted: TestUser;

beforeAll(async () => {
  author = await createUser('auteur');
  author2 = await createUser('auteur2');
  moderator = await createUser('moderateur', ['moderator']);
  admin = await createUser('admin', ['admin']);
  trusted = await createUser('fiable', ['trusted_contributor']);
});

afterAll(async () => {
  await setSetting('auto_publish_categories', []);
  await setSetting('demo_mode', false);
  await deleteCreatedUsers();
  await closeDb();
});

async function submit(overrides: Record<string, unknown> = {}, user: TestUser = author) {
  const { data, error } = await user.client.rpc('submit_report', reportParams(overrides));
  if (error) throw error;
  return data.report_id as string;
}

describe('modération des signalements', () => {
  it('réserve la modération à l’équipe', async () => {
    const reportId = await submit();
    for (const user of [author, trusted]) {
      const { error } = await user.client.rpc('moderate_approve_report', {
        p_report_id: reportId,
        p_mode: 'new_event',
        p_event_id: null,
        p_status: 'under_review',
        p_severity: 'vigilance',
      });
      expect(error?.message).toContain('forbidden');
    }
  });

  it('refuse une gravité supérieure au plafond du statut', async () => {
    const reportId = await submit();
    const { error } = await moderator.client.rpc('moderate_approve_report', {
      p_report_id: reportId,
      p_mode: 'new_event',
      p_event_id: null,
      p_status: 'under_review',
      p_severity: 'critical',
    });
    expect(error?.message).toContain('severity_exceeds_status_cap');
    const { rows } = await db().query(
      `select moderation_status from public.alert_reports where id = $1`,
      [reportId],
    );
    expect(rows[0].moderation_status).toBe('pending');
  });

  it('crée un événement public, traçable, et alimente l’outbox de notifications', async () => {
    const reportId = await submit();
    const approve = await moderator.client.rpc('moderate_approve_report', {
      p_report_id: reportId,
      p_mode: 'new_event',
      p_event_id: null,
      p_status: 'under_review',
      p_severity: 'vigilance',
      p_public_note: 'Fumée signalée, vérification en cours.',
    });
    expect(approve.error).toBeNull();
    const eventId = approve.data as string;

    // Visible par un visiteur, avec la commune résolue.
    const { data: feed } = await anonClient()
      .from('event_feed')
      .select('*')
      .eq('id', eventId)
      .single();
    expect(feed).toMatchObject({
      status: 'under_review',
      severity: 'vigilance',
      commune_code: '1501',
      commune_name_fr: 'Tizi Ouzou',
      report_count: 1,
    });

    // Le signalement brut reste privé.
    const raw = await anonClient().from('alert_reports').select('id').eq('id', reportId);
    expect(raw.error).not.toBeNull();

    // Confirmation avec gravité critique et justification obligatoire.
    const noReason = await moderator.client.rpc('moderate_update_event', {
      p_event_id: eventId,
      p_status: 'confirmed',
      p_severity: 'critical',
    });
    expect(noReason.error?.message).toContain('reason_required');
    const confirm = await moderator.client.rpc('moderate_update_event', {
      p_event_id: eventId,
      p_status: 'confirmed',
      p_severity: 'critical',
      p_reason: 'Confirmé par la Protection civile (appel téléphonique du poste local)',
    });
    expect(confirm.error).toBeNull();

    const { rows: history } = await db().query(
      `select kind, old_status, new_status, old_severity, new_severity, reason
       from public.alert_event_updates where event_id = $1 order by id`,
      [eventId],
    );
    expect(history.map((h) => h.kind)).toEqual(['created', 'status_change', 'severity_change']);
    expect(history[1]).toMatchObject({ old_status: 'under_review', new_status: 'confirmed' });
    expect(history[2].reason).toContain('Protection civile');

    const { rows: outbox } = await db().query(
      `select reason, event_version from public.notification_outbox where event_id = $1 order by id`,
      [eventId],
    );
    expect(outbox.map((o) => o.reason)).toEqual(['published', 'status_upgraded']);

    const { rows: audit } = await db().query(
      `select action from public.audit_logs where target_id in ($1, $2) order by id`,
      [eventId, reportId],
    );
    expect(audit.map((a) => a.action)).toEqual(
      expect.arrayContaining(['report.approved', 'event.updated']),
    );
  });

  it('rattache un doublon à un événement existant sans double comptage par auteur', async () => {
    const first = await submit();
    const { data: eventId } = await moderator.client.rpc('moderate_approve_report', {
      p_report_id: first,
      p_mode: 'new_event',
      p_event_id: null,
      p_status: 'under_review',
      p_severity: 'vigilance',
    });
    const second = await submit({ p_lat: 36.713, p_lng: 4.047 });
    const merge = await moderator.client.rpc('moderate_approve_report', {
      p_report_id: second,
      p_mode: 'attach',
      p_event_id: eventId,
      p_status: 'under_review',
      p_severity: 'vigilance',
    });
    expect(merge.error).toBeNull();
    const { rows } = await db().query(
      `select report_count from public.alert_events where id = $1`,
      [eventId],
    );
    // Deux signalements du même auteur = une seule source.
    expect(rows[0].report_count).toBe(1);
  });

  it('rejette avec motif, notifie l’auteur et permet une contestation', async () => {
    const reportId = await submit({}, author2);
    const reject = await moderator.client.rpc('moderate_reject_report', {
      p_report_id: reportId,
      p_reason: 'insufficient_information',
      p_note: 'Pas assez de détails',
    });
    expect(reject.error).toBeNull();
    const { data: inbox } = await author2.client
      .from('user_notifications')
      .select('kind, data')
      .eq('kind', 'moderation');
    expect(inbox?.some((n) => n.data.report_id === reportId)).toBe(true);

    const appeal = await author2.client.rpc('create_appeal', {
      p_report_id: reportId,
      p_message: 'J’ai ajouté des précisions : la fumée venait de la crête est.',
    });
    expect(appeal.error).toBeNull();
    const decide = await moderator.client.rpc('decide_appeal', {
      p_appeal_id: appeal.data,
      p_accept: true,
      p_note: 'Réexamen',
    });
    expect(decide.error).toBeNull();
    const { rows } = await db().query(
      `select moderation_status from public.alert_reports where id = $1`,
      [reportId],
    );
    expect(rows[0].moderation_status).toBe('pending');
  });

  it('permet aux contributeurs fiables d’ajouter un avis sans changer le statut', async () => {
    const reportId = await submit({}, author2);
    const { data: eventId } = await moderator.client.rpc('moderate_approve_report', {
      p_report_id: reportId,
      p_mode: 'new_event',
      p_event_id: null,
      p_status: 'under_review',
      p_severity: 'vigilance',
    });
    const add = await trusted.client.rpc('add_event_verification', {
      p_event_id: eventId,
      p_verdict: 'supports',
      p_note: 'Fumée visible depuis Redjaouna également.',
    });
    expect(add.error).toBeNull();
    const update = await trusted.client.rpc('moderate_update_event', {
      p_event_id: eventId,
      p_status: 'confirmed',
      p_reason: 'je confirme',
    });
    expect(update.error?.message).toContain('forbidden');
    const { rows } = await db().query(`select status from public.alert_events where id = $1`, [
      eventId,
    ]);
    expect(rows[0].status).toBe('under_review');
  });

  it('publie automatiquement « Reçu, non vérifié » seulement si configuré, plafonné à vigilance', async () => {
    await setSetting('auto_publish_categories', ['flood']);
    const { data } = await author2.client.rpc(
      'submit_report',
      reportParams({
        p_category_id: 'flood',
        p_subcategory_id: 'flood.landslide', // gravité par défaut « important »
        p_description: 'Glissement de terrain sur la route communale.',
        p_location_precision: 'exact',
      }),
    );
    expect(data.event_id).toBeTruthy();
    const { data: event } = await anonClient()
      .from('event_feed')
      .select('status, severity, is_public')
      .eq('id', data.event_id)
      .single();
    expect(event).toEqual({ status: 'received', severity: 'vigilance', is_public: true });
    await setSetting('auto_publish_categories', []);

    // Rejet du signalement → l'événement automatique disparaît.
    const reject = await moderator.client.rpc('moderate_reject_report', {
      p_report_id: data.report_id,
      p_reason: 'false_or_misleading',
    });
    expect(reject.error).toBeNull();
    const after = await anonClient().from('event_feed').select('id').eq('id', data.event_id);
    expect(after.data).toEqual([]);
  });
});

describe('administration', () => {
  it('réserve la gestion des rôles aux administrateurs et la journalise', async () => {
    const denied = await moderator.client.rpc('admin_set_role', {
      p_user_id: trusted.id,
      p_role: 'moderator',
      p_grant: true,
      p_reason: 'test',
    });
    expect(denied.error?.message).toContain('forbidden');

    const direct = await moderator.client
      .from('user_roles')
      .insert({ user_id: moderator.id, role: 'admin' });
    expect(direct.error?.code).toBe('42501');

    const granted = await admin.client.rpc('admin_set_role', {
      p_user_id: trusted.id,
      p_role: 'partner',
      p_grant: true,
      p_reason: 'Association de village vérifiée',
      p_organization: 'Comité de village (test)',
    });
    expect(granted.error).toBeNull();
    const { rows } = await db().query(
      `select action from public.audit_logs where target_id = $1 and action = 'role.granted'`,
      [trusted.id],
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it('exige le MFA (aal2) pour l’administration quand le paramètre est actif', async () => {
    await db().query(
      `update public.app_settings set value = 'true' where key = 'require_admin_mfa'`,
    );
    try {
      const { error } = await admin.client.rpc('admin_update_setting', {
        p_key: 'ads_enabled',
        p_value: false,
      });
      expect(error?.message).toContain('mfa_required');
    } finally {
      await db().query(
        `update public.app_settings set value = 'false' where key = 'require_admin_mfa'`,
      );
    }
  });

  it('protège la réputation et la suspension contre la modification par l’utilisateur', async () => {
    const { error } = await author.client
      .from('profiles')
      .update({ reputation: 1000 })
      .eq('id', author.id);
    expect(error?.code).toBe('42501');
    const ok = await author.client
      .from('profiles')
      .update({ display_name: 'Auteur Test' })
      .eq('id', author.id);
    expect(ok.error).toBeNull();
  });

  it('réserve le journal d’audit aux administrateurs', async () => {
    const asModerator = await moderator.client.from('audit_logs').select('id').limit(1);
    expect(asModerator.data).toEqual([]);
    const asAdmin = await admin.client.from('audit_logs').select('id').limit(1);
    expect(asAdmin.data?.length).toBe(1);
  });

  it('masque les données de démonstration hors mode démo', async () => {
    const { rows } = await db().query(
      `insert into public.alert_events (category_id, subcategory_id, status, severity, is_public, is_demo, location)
       values ('weather', 'weather.snow', 'confirmed', 'vigilance', true, true,
               extensions.st_setsrid(extensions.st_makepoint(4.05, 36.71), 4326)::extensions.geography)
       returning id`,
    );
    const demoId = rows[0].id;
    const hidden = await anonClient().from('event_feed').select('id').eq('id', demoId);
    expect(hidden.data).toEqual([]);
    await setSetting('demo_mode', true);
    const shown = await anonClient().from('event_feed').select('id, is_demo').eq('id', demoId);
    expect(shown.data).toEqual([{ id: demoId, is_demo: true }]);
    await setSetting('demo_mode', false);
    // Aucune notification n'est produite pour une donnée de démonstration.
    const { rows: outbox } = await db().query(
      `select count(*)::int as n from public.notification_outbox where event_id = $1`,
      [demoId],
    );
    expect(outbox[0].n).toBe(0);
    await db().query(`delete from public.alert_events where id = $1`, [demoId]);
  });
});
