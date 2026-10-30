# API

Le web et le mobile lisent les données publiques directement via l'API Supabase (PostgREST),
protégée par RLS. Les écritures passent par des **fonctions SQL** (`SECURITY DEFINER`, contrôles
de rôle et de cohérence en base) ou par des **routes serveur** Next.js lorsque des secrets sont
nécessaires. Les codes d'erreur sont stables (ex. `rate_limited`, `outside_coverage`) et traduits
côté client (`packages/shared/src/errors.ts`).

## Routes HTTP (`apps/web`)

| Méthode    | Route                         | Accès                                      | Rôle                                                                              |
| ---------- | ----------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------- |
| GET        | `/api/health`                 | Public                                     | État du service (sans détail sensible)                                            |
| GET        | `/auth/confirm`               | Lien e-mail (`token_hash`, `type`, `next`) | Confirmation d'inscription / réinitialisation du mot de passe                     |
| GET        | `/api/account/export`         | Utilisateur connecté                       | Export JSON de ses données (`export_my_data`)                                     |
| POST       | `/api/notifications/test`     | Utilisateur connecté (limité)              | Notification de test vers ses propres appareils                                   |
| POST       | `/api/admin/media`            | Équipe de modération                       | `{ mediaId, approve }` : publication (ré-encodage sans EXIF) ou rejet d'une photo |
| POST       | `/api/admin/sources`          | Administrateur + MFA                       | Activer / désactiver / synchroniser une source externe                            |
| GET / POST | `/api/cron/sources[?source=]` | `Authorization: Bearer CRON_SECRET`        | Synchronisation des sources activées                                              |
| GET / POST | `/api/cron/notifications`     | `Authorization: Bearer CRON_SECRET`        | Traitement de l'outbox + accusés de réception Expo                                |

Les actions de formulaire du site (signalement, villages, modération…) sont des Server Actions
Next.js qui appellent les mêmes fonctions SQL.

## Lecture publique (PostgREST)

| Ressource             | Contenu                                                                   |
| --------------------- | ------------------------------------------------------------------------- |
| `event_feed` (vue)    | Événements publics normalisés (lat/lng, commune, wilaya, statut, gravité) |
| `alert_event_updates` | Historique public d'un événement                                          |
| `alert_verifications` | Vérifications publiques (méthode, verdict)                                |
| `alert_media`         | Photos approuvées (copies publiques ré-encodées)                          |
| `alert_sources`       | Sources, état, attribution                                                |

## Fonctions SQL (RPC) principales

| Fonction                                                           | Appelant                                | Rôle                                                                |
| ------------------------------------------------------------------ | --------------------------------------- | ------------------------------------------------------------------- |
| `events_in_bbox(...)`                                              | Public                                  | Événements d'une emprise (PostGIS), filtres catégories/statuts/date |
| `events_near(lat, lng, radius_m, ...)`                             | Public                                  | Événements autour d'un point (historique d'un lieu suivi)           |
| `observations_in_bbox(...)`                                        | Public                                  | Séismes, points chauds, prévisions                                  |
| `search_places(q, max_results)`                                    | Public                                  | Recherche wilaya / commune / village (accents, graphies kabyles)    |
| `commune_boundaries_geojson(...)`                                  | Public                                  | Contours des communes (fond de carte de repli)                      |
| `submit_report(...)`                                               | Utilisateur                             | Signalement (validation, limites, idempotence, doublons proches)    |
| `register_report_media(report_id, path)`                           | Auteur                                  | Déclare une photo déposée en quarantaine                            |
| `update_report_description` / `withdraw_report`                    | Auteur                                  | Correction (30 min) ou retrait d'un signalement en attente          |
| `create_appeal` / `create_abuse_report`                            | Utilisateur                             | Contestation d'un rejet / signalement d'un contenu                  |
| `my_followed_places_summary()`                                     | Utilisateur                             | Lieux suivis + alertes actives                                      |
| `propose_village(name, lat, lng)`                                  | Utilisateur                             | Proposition d'un village au référentiel                             |
| `register_push_token` / `unregister_push_token`                    | Utilisateur                             | Appareils pour les notifications (10 maximum)                       |
| `mark_notifications_read(ids?)`                                    | Utilisateur                             | Boîte de réception                                                  |
| `export_my_data()`                                                 | Utilisateur                             | Export RGPD                                                         |
| `moderate_approve_report` / `moderate_reject_report`               | Équipe                                  | Décision de modération (jamais sur son propre signalement)          |
| `moderate_update_event` / `moderate_set_event_visibility`          | Équipe, partenaire (limité)             | Statut, gravité (plafonnée), note publique, visibilité              |
| `add_event_verification`                                           | Équipe, partenaire, contributeur fiable | Vérification (pas d'auto-corroboration)                             |
| `review_village`                                                   | Équipe                                  | Validation des villages proposés                                    |
| `admin_set_role` / `admin_set_suspension` / `admin_update_setting` | Administrateur (+ MFA)                  | Rôles, suspensions, réglages                                        |
| `admin_dashboard_stats` / `admin_find_users`                       | Équipe / administrateur                 | Tableau de bord, recherche d'utilisateurs                           |

Les fonctions réservées au serveur (`notification_candidates`, `increment_token_failure`,
`service_log_audit`) ne sont exécutables qu'avec la clé secrète (droits révoqués pour `anon` et
`authenticated`). `commune_points` (centroïdes publics des communes) reste lisible par tous.

Types TypeScript générés : `packages/shared/src/database.types.ts` (`pnpm db:types`).
