-- =====================================================================
-- Données de référence (nécessaires en production) : catalogue des
-- catégories (miroir de packages/shared/src/domain/categories.ts — un test
-- d'intégration vérifie la cohérence), sources et paramètres applicatifs.
-- Aucune alerte n'est insérée ici.
-- =====================================================================

insert into public.alert_categories (id, icon, color, priority, module, validation_rules, notification_rules, sort_order)
values
  ('fire', 'flame', '#D84315', 1, 'alerts',
   '{"minDescriptionLength":10,"maxObservedAgeHours":24,"photoRecommended":true,"allowUncertainLocation":true}',
   '{"notifiable":true,"minStatusForPush":"under_review","dedupWindowMinutes":180,"dedupRadiusMeters":3000}', 1),
  ('flood', 'waves', '#0277BD', 1, 'alerts',
   '{"minDescriptionLength":10,"maxObservedAgeHours":24,"photoRecommended":true,"allowUncertainLocation":true}',
   '{"notifiable":true,"minStatusForPush":"under_review","dedupWindowMinutes":240,"dedupRadiusMeters":2000}', 2),
  ('earthquake', 'activity', '#6D4C41', 1, 'alerts',
   '{"minDescriptionLength":5,"maxObservedAgeHours":12,"photoRecommended":false,"allowUncertainLocation":true}',
   '{"notifiable":true,"minStatusForPush":"confirmed","dedupWindowMinutes":60,"dedupRadiusMeters":30000}', 3),
  ('weather', 'cloud-lightning', '#5E35B1', 2, 'alerts',
   '{"minDescriptionLength":5,"maxObservedAgeHours":12,"photoRecommended":false,"allowUncertainLocation":true}',
   '{"notifiable":true,"minStatusForPush":"corroborated","dedupWindowMinutes":360,"dedupRadiusMeters":10000}', 4),
  ('traffic', 'car', '#B26A00', 3, 'alerts',
   '{"minDescriptionLength":10,"maxObservedAgeHours":12,"photoRecommended":true,"allowUncertainLocation":false}',
   '{"notifiable":true,"minStatusForPush":"corroborated","dedupWindowMinutes":120,"dedupRadiusMeters":500}', 5),
  ('utilities', 'zap', '#00838F', 4, 'alerts',
   '{"minDescriptionLength":10,"maxObservedAgeHours":48,"photoRecommended":false,"allowUncertainLocation":false}',
   '{"notifiable":true,"minStatusForPush":"corroborated","dedupWindowMinutes":720,"dedupRadiusMeters":3000}', 6),
  ('local_hazard', 'triangle-alert', '#AD1457', 2, 'alerts',
   '{"minDescriptionLength":15,"maxObservedAgeHours":72,"photoRecommended":true,"allowUncertainLocation":false}',
   '{"notifiable":true,"minStatusForPush":"corroborated","dedupWindowMinutes":1440,"dedupRadiusMeters":300}', 7),
  ('mutual_aid', 'hand-heart', '#2D7B57', 5, 'assistance',
   '{"minDescriptionLength":20,"maxObservedAgeHours":168,"photoRecommended":false,"allowUncertainLocation":false}',
   '{"notifiable":false,"minStatusForPush":"confirmed","dedupWindowMinutes":1440,"dedupRadiusMeters":1000}', 8)
on conflict (id) do update
  set icon = excluded.icon, color = excluded.color, priority = excluded.priority, module = excluded.module,
      validation_rules = excluded.validation_rules, notification_rules = excluded.notification_rules,
      sort_order = excluded.sort_order;

insert into public.alert_subcategories (id, category_id, reportable, default_severity, sort_order)
values
  ('fire.smoke', 'fire', true, 'vigilance', 1),
  ('fire.suspected_start', 'fire', true, 'vigilance', 2),
  ('fire.spread_documented', 'fire', true, 'important', 3),
  ('fire.confirmed', 'fire', false, 'important', 4),
  ('fire.ended', 'fire', false, 'information', 5),
  ('flood.flooding', 'flood', true, 'vigilance', 1),
  ('flood.submerged_road', 'flood', true, 'vigilance', 2),
  ('flood.overflow', 'flood', true, 'vigilance', 3),
  ('flood.dangerous_rain', 'flood', true, 'vigilance', 4),
  ('flood.landslide', 'flood', true, 'important', 5),
  ('earthquake.felt', 'earthquake', true, 'information', 1),
  ('earthquake.damage', 'earthquake', true, 'important', 2),
  ('earthquake.recorded', 'earthquake', false, 'information', 3),
  ('weather.thunderstorm', 'weather', true, 'vigilance', 1),
  ('weather.snow', 'weather', true, 'vigilance', 2),
  ('weather.strong_wind', 'weather', true, 'vigilance', 3),
  ('weather.heatwave', 'weather', true, 'vigilance', 4),
  ('weather.frost', 'weather', true, 'information', 5),
  ('weather.heavy_precipitation', 'weather', true, 'vigilance', 6),
  ('traffic.accident', 'traffic', true, 'vigilance', 1),
  ('traffic.road_closed', 'traffic', true, 'vigilance', 2),
  ('traffic.rockfall', 'traffic', true, 'vigilance', 3),
  ('traffic.obstacle', 'traffic', true, 'information', 4),
  ('traffic.bridge_impassable', 'traffic', true, 'important', 5),
  ('traffic.snow_on_road', 'traffic', true, 'vigilance', 6),
  ('utilities.water_outage', 'utilities', true, 'information', 1),
  ('utilities.power_outage', 'utilities', true, 'information', 2),
  ('utilities.network_outage', 'utilities', true, 'information', 3),
  ('utilities.transport_interruption', 'utilities', true, 'information', 4),
  ('utilities.service_unavailable', 'utilities', true, 'information', 5),
  ('local_hazard.power_line', 'local_hazard', true, 'vigilance', 1),
  ('local_hazard.building_collapse', 'local_hazard', true, 'vigilance', 2),
  ('local_hazard.pollution', 'local_hazard', true, 'vigilance', 3),
  ('local_hazard.other', 'local_hazard', true, 'information', 4),
  ('mutual_aid.assistance_needed', 'mutual_aid', true, 'information', 1),
  ('mutual_aid.material_distribution', 'mutual_aid', true, 'information', 2),
  ('mutual_aid.volunteers_needed', 'mutual_aid', true, 'information', 3),
  ('mutual_aid.logistics', 'mutual_aid', true, 'information', 4)
on conflict (id) do update
  set reportable = excluded.reportable, default_severity = excluded.default_severity,
      sort_order = excluded.sort_order;

-- Sources. Les sources externes sont DÉSACTIVÉES par défaut : leur activation suppose
-- d'avoir vérifié les conditions d'utilisation (usage commercial éventuel) et, le cas
-- échéant, configuré la clé API côté serveur. Voir docs/data-sources.md.
insert into public.alert_sources (id, name, kind, homepage_url, documentation_url, license, attribution,
                                  requires_key, enabled, sync_interval_minutes, config)
values
  ('community', 'Communauté Tamurt Alerte', 'community', null, null,
   'Contributions des utilisateurs (conditions d''utilisation Tamurt Alerte)',
   'Signalements de la communauté, vérifiés par l''équipe de modération', false, true, null, '{}'),
  ('emsc', 'EMSC-CSEM (Centre sismologique euro-méditerranéen)', 'seismic',
   'https://www.emsc-csem.org', 'https://www.seismicportal.eu/fdsnws/event/1/',
   'Conditions d''utilisation EMSC — à vérifier avant activation en production',
   'Données sismiques : EMSC-CSEM', false, false, 10,
   '{"minMagnitude": 2.5, "lookbackHours": 72, "eventMinMagnitude": 3.0}'),
  ('nasa_firms', 'NASA FIRMS (points chauds VIIRS/MODIS)', 'satellite',
   'https://firms.modaps.eosdis.nasa.gov', 'https://firms.modaps.eosdis.nasa.gov/api/',
   'Données NASA — politique de données ouvertes, citation demandée (à vérifier)',
   'Points chauds : NASA FIRMS (LANCE)', true, false, 30,
   '{"products": ["VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT"], "dayRange": 1}'),
  ('open_meteo', 'Open-Meteo (prévisions)', 'forecast',
   'https://open-meteo.com', 'https://open-meteo.com/en/docs',
   'API gratuite réservée à un usage non commercial ; offre commerciale avec clé (CC BY 4.0 pour les données)',
   'Prévisions météo : Open-Meteo.com', false, false, 180,
   '{"thresholds": {"precipitationMmPerHour": 10, "windGustsKmh": 80, "temperatureMaxC": 40, "temperatureMinC": -2}}')
on conflict (id) do update
  set name = excluded.name, kind = excluded.kind, homepage_url = excluded.homepage_url,
      documentation_url = excluded.documentation_url, license = excluded.license,
      attribution = excluded.attribution, requires_key = excluded.requires_key;

insert into public.regions (id, name_fr, name_ar, name_kab, coverage_status)
values ('kabylie', 'Kabylie', 'منطقة القبائل', 'Tamurt n Leqbayel', 'active')
on conflict (id) do nothing;

insert into public.app_settings (key, value, is_public, description)
values
  ('demo_mode', 'false', true, 'Affiche les données marquées DÉMO. Jamais en production.'),
  ('auto_publish_categories', '[]', false,
   'Catégories publiées immédiatement au statut « Reçu, non vérifié » (vide = modération préalable).'),
  ('require_admin_mfa', 'true', false, 'Exige une session aal2 (TOTP) pour les fonctions d''administration.'),
  ('emergency_numbers', '{"verified": false, "verified_at": null, "verified_by": null, "items": []}', true,
   'Numéros d''urgence affichés uniquement après vérification par l''équipe.'),
  ('push_rate_limit_per_hour', '6', false, 'Nombre maximal de push non critiques par utilisateur et par heure.'),
  ('ads_enabled', 'false', true, 'Composant publicitaire (désactivé tant qu''aucune régie n''est intégrée).'),
  ('coverage', '{"region": "kabylie", "wilayas": ["15", "06", "10", "35", "34", "19"]}', true,
   'Zone couverte par le référentiel géographique.')
on conflict (key) do nothing;
