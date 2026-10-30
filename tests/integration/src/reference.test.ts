import { afterAll, describe, expect, it } from 'vitest';
import { CATEGORIES, KABYLIE_REGION } from '@tamurt/shared';
import { anonClient, closeDb, db } from './helpers';

afterAll(closeDb);

describe('référentiel et catalogue', () => {
  it('reflète exactement le catalogue de @tamurt/shared', async () => {
    const { rows: categories } = await db().query(
      `select id, icon, color, priority, module, validation_rules, notification_rules
       from public.alert_categories order by sort_order`,
    );
    expect(categories.map((c) => c.id)).toEqual(CATEGORIES.map((c) => c.id));
    for (const category of CATEGORIES) {
      const row = categories.find((c) => c.id === category.id);
      expect(row).toMatchObject({
        icon: category.icon,
        color: category.color,
        priority: category.priority,
        module: category.module,
      });
      expect(row.validation_rules).toEqual(category.validation);
      expect(row.notification_rules).toEqual(category.notification);

      const { rows: subs } = await db().query(
        `select id, reportable, default_severity from public.alert_subcategories
         where category_id = $1 order by sort_order`,
        [category.id],
      );
      expect(subs).toEqual(
        category.subcategories.map((s) => ({
          id: s.id,
          reportable: s.reportable,
          default_severity: s.defaultSeverity,
        })),
      );
    }
  });

  it('couvre les wilayas configurées avec des contours valides', async () => {
    const { rows } = await db().query(
      `select w.code, count(c.code)::int as communes,
              bool_and(extensions.st_isvalid(c.boundary)) as valid,
              bool_and(extensions.st_intersects(c.boundary, c.centroid::extensions.geometry)) as centroid_inside
       from public.wilayas w join public.communes c on c.wilaya_code = w.code
       group by w.code order by w.code`,
    );
    expect(rows.map((r) => r.code).sort()).toEqual([...KABYLIE_REGION.wilayaCodes].sort());
    const tiziOuzou = rows.find((r) => r.code === '15');
    expect(tiziOuzou.communes).toBe(67);
    for (const row of rows) {
      expect(row.valid).toBe(true);
      expect(row.centroid_inside).toBe(true);
    }
  });
});

describe('accès public (visiteur non connecté)', () => {
  const anon = anonClient();

  it('peut consulter les communes et rechercher un lieu (graphies kabyles)', async () => {
    const { data, error } = await anon.rpc('search_places', {
      q: 'larbaa nath irathen',
      max_results: 5,
    });
    expect(error).toBeNull();
    expect(data?.[0]).toMatchObject({ kind: 'commune', name_fr: "Larbaa N'Aït Irathen" });

    const { data: beni } = await anon.rpc('search_places', { q: 'At Yenni' });
    expect(beni?.[0]?.name_fr).toBe('Beni Yenni');
  });

  it('peut lire les sources publiques mais pas leur configuration', async () => {
    const ok = await anon.from('alert_sources').select('id, name, attribution, enabled');
    expect(ok.error).toBeNull();
    expect(ok.data?.map((s) => s.id).sort()).toEqual([
      'community',
      'emsc',
      'nasa_firms',
      'open_meteo',
    ]);
    const denied = await anon.from('alert_sources').select('config');
    expect(denied.error?.code).toBe('42501');
  });

  it('ne peut lire ni les signalements bruts ni le journal d’audit', async () => {
    const reports = await anon.from('alert_reports').select('id');
    expect(reports.error?.code).toBe('42501');
    const audit = await anon.from('audit_logs').select('id');
    expect(audit.error?.code).toBe('42501');
  });

  it('ne peut pas écrire d’événement ni appeler les fonctions réservées', async () => {
    const insert = await anon.from('alert_events').insert({
      category_id: 'fire',
      subcategory_id: 'fire.smoke',
      location: 'SRID=4326;POINT(4.05 36.71)',
    });
    expect(insert.error).not.toBeNull();
    const submit = await anon.rpc('submit_report', {});
    expect(submit.error).not.toBeNull();
    const candidates = await anon.rpc('notification_candidates', {
      p_event_id: '00000000-0000-0000-0000-000000000000',
    });
    expect(candidates.error).not.toBeNull();
  });

  it('expose uniquement les paramètres publics', async () => {
    const { data } = await anon.from('app_settings').select('key');
    const keys = (data ?? []).map((s) => s.key);
    expect(keys).toContain('demo_mode');
    expect(keys).not.toContain('require_admin_mfa');
    expect(keys).not.toContain('auto_publish_categories');
  });
});
