# Modèle de sécurité

## Principes

- **Défense en profondeur** : chaque règle métier sensible (plafond de gravité, transitions de
  statut, limites anti-abus, non-publication avant modération) est appliquée **en base** (RLS,
  triggers, fonctions `SECURITY DEFINER`), pas seulement dans l'interface.
- **Moindre privilège** : `auto_expose_new_tables = false` ; chaque table est accordée
  explicitement (`20261030100900_grants.sql`) et protégée par RLS ; les fonctions sensibles vivent
  dans le schéma `private` (non exposé par l'API) avec `set search_path = ''`.
- **Aucun secret côté client** : le navigateur et l'application mobile ne reçoivent que l'URL
  Supabase et la clé **publiable** (protégée par RLS). Les clés secrètes (`SUPABASE_SECRET_KEY`,
  `NASA_FIRMS_MAP_KEY`, `OPEN_METEO_API_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`,
  `EXPO_ACCESS_TOKEN`) ne sont lues que dans `apps/web/lib/env.server.ts` (module `server-only`).

## Contrôles en place

| Risque                                     | Mesure                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fausse alerte présentée comme officielle   | Un signalement n'est jamais publié sans modération ; **pas d'auto-modération** : personne ne peut valider ou rejeter son propre signalement, ni relever le statut d'un événement auquel il a contribué ou l'appuyer par une vérification (`self_moderation_forbidden`, testé) ; gravité plafonnée selon le statut (trigger) ; « Critique » réservé à une confirmation par une source habilitée |
| Spam / abus                                | 5 signalements/heure et 20/jour par compte (en base) ; limites Supabase Auth ; signalement de contenus ; suspension de compte                                                                                                                                                                                                                                                                  |
| Doublons                                   | Idempotence par `client_id` ; détection de doublons proches (rayon/fenêtre par catégorie)                                                                                                                                                                                                                                                                                                      |
| Données personnelles publiées              | Refus des numéros de téléphone et e-mails dans les textes publics (client + base) ; texte brut des signalements jamais publié tel quel                                                                                                                                                                                                                                                         |
| Métadonnées des photos (GPS)               | Ré-encodage côté client puis **ré-encodage serveur obligatoire** (sharp → WebP, sans EXIF/XMP/ICC) avant publication ; bucket de quarantaine privé                                                                                                                                                                                                                                             |
| Prise de contrôle de l'administration      | Rôles en base (`user_roles`) ; MFA TOTP (`aal2`) exigé en production (`REQUIRE_ADMIN_MFA`) pour les actions d'administration sensibles — rôles, sources externes, paramètres — contrôlé en base et dans les routes ; journal d'audit de toutes les décisions                                                                                                                                   |
| Escalade de rôle                           | Attribution de rôle uniquement par un administrateur (fonction auditée) ; jamais de promotion automatique par la réputation ; impossible de retirer le dernier administrateur                                                                                                                                                                                                                  |
| Appels non autorisés des tâches planifiées | `Authorization: Bearer CRON_SECRET` comparé en temps constant                                                                                                                                                                                                                                                                                                                                  |
| Clickjacking, XSS, MIME sniffing           | CSP stricte, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, pas de `X-Powered-By` (vérifié par les tests e2e)                                                                                                                                                                                                                                                |
| Session mobile                             | Jetons dans le trousseau sécurisé (Keychain / Keystore via `expo-secure-store`), rafraîchis seulement au premier plan                                                                                                                                                                                                                                                                          |
| Localisation                               | Aucune localisation en arrière-plan (permission Android bloquée explicitement) ; position du téléphone jamais enregistrée                                                                                                                                                                                                                                                                      |
| Notifications                              | Ciblage côté serveur uniquement ; une information non vérifiée n'est jamais envoyée au-delà de « Vigilance » ; anti-spam (6 push non critiques/heure) ; heures silencieuses                                                                                                                                                                                                                    |

## Vérifications automatisées

- `tests/integration` (base réelle) : RLS par rôle, non-publication avant modération, plafonds de
  gravité, limites de débit, médias, comptes, notifications, villages.
- `apps/web/e2e` : parcours complet, en-têtes de sécurité, accessibilité, pages protégées.
- `supabase db lint` (plpgsql_check) en CI.

## Points à traiter avant production

- Relecture juridique des pages Confidentialité et Conditions (marquées « document de travail »).
- Vérification officielle des numéros d'urgence avant affichage (actuellement masqués).
- Activer la protection contre les mots de passe compromis et un SMTP dédié (Supabase Auth).
- Revue de sécurité indépendante (test d'intrusion) recommandée avant ouverture au public.
