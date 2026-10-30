# Architecture — Tamurt Alerte

Document vivant : il consigne les décisions techniques structurantes et leurs raisons.
Les détails sont dans `docs/architecture/`.

## Vue d'ensemble

```
apps/web        Next.js 16 (App Router) — site public, espace connecté, administration, routes serveur (/api)
apps/mobile     Expo SDK 58 (React Native 0.88, expo-router) — iOS / Android
packages/shared Domaine métier pur : catégories, statuts, gravités, rôles, schémas Zod,
                i18n (fr/kab/ar), jetons de design, logique de notification. Utilisé partout.
packages/server Code serveur uniquement : adaptateurs de sources externes, synchronisation,
                moteur d'envoi des notifications, traitement des médias. Jamais importé côté client.
supabase/       Migrations SQL versionnées, seed de référence, configuration locale
tests/          Tests d'intégration (base de données réelle, RLS, flux métier)
scripts/        Génération du référentiel géographique, mode démo
docs/           Architecture, API, déploiement, sécurité, sources de données
```

## Décisions

### D1 — Monorepo pnpm, paquets internes en TypeScript source

Les paquets `@tamurt/shared` et `@tamurt/server` sont consommés en TypeScript source
(`transpilePackages` côté Next.js, Metro côté Expo, Vitest pour les tests) : pas d'étape de build
intermédiaire, une seule source de vérité pour les règles métier.

### D2 — Versions (vérifiées le 30/10/2026)

| Outil                         | Version        | Raison                                                                                                                |
| ----------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------- |
| Node.js                       | 22 LTS         | Requis ≥ 22.12 par Vitest 5                                                                                           |
| TypeScript                    | 6.0.3          | TS 7 (natif) n'expose pas encore d'API JS : incompatible avec typescript-eslint (`<6.1`)                              |
| React                         | 19.3.0         | Version imposée par Expo SDK 58, alignée sur le web pour éviter deux copies de React                                  |
| Next.js                       | 16.4.3         | `proxy.ts` remplace `middleware.ts`, API de requête asynchrones                                                       |
| Expo SDK                      | 58 (RN 0.88.1) | Nouvelle architecture obligatoire                                                                                     |
| ESLint                        | 10.13          | ESLint 9 n'est plus maintenu ; `eslint-config-next` 16.4 supporte ESLint 10 (React version fixée côté Expo, voir D10) |
| Supabase CLI                  | 2.122          | Pile locale Docker (Postgres 17 + PostGIS 3.3)                                                                        |
| Zod                           | 4.6            | Schémas partagés client/serveur                                                                                       |
| MapLibre GL JS                | 6.16           | Carte web                                                                                                             |
| MapLibre React Native         | 11.5           | Carte mobile, même style vectoriel que le web ; nécessite un build de développement (pas Expo Go)                     |
| Playwright (@playwright/test) | 1.63.0         | Aligné sur le navigateur Chromium préinstallé de l'environnement                                                      |

### D3 — Séparation stricte signalement / événement / preuve / notification

- `alert_reports` : le signalement brut d'un utilisateur (jamais public tel quel).
- `alert_events` : l'événement public qui regroupe une ou plusieurs observations (dédoublonnage).
- `alert_verifications` : preuves et confirmations (modérateur, source habilitée, satellite…).
- `user_notifications` / `notification_deliveries` : ce qui a été produit et envoyé.

Un même incident n'est compté qu'une fois : les signalements proches (catégorie, distance, fenêtre
temporelle définies par catégorie) sont rattachés au même événement.

### D4 — Plafonds de gravité selon la vérification

Une information non vérifiée est plafonnée à « vigilance », une information recoupée à
« important » ; seule une confirmation par une source habilitée permet « critique ».
Règle codée dans `@tamurt/shared` ET imposée en base (trigger) — le client n'est jamais cru sur parole.

### D5 — Autorisations contrôlées par la base

RLS sur toutes les tables exposées, `auto_expose_new_tables = false` (GRANT explicites), écritures
sensibles via fonctions `SECURITY DEFINER` qui vérifient le rôle (`user_roles`), journalisent
(`audit_logs`) et appliquent les invariants. Les vérifications côté interface ne sont qu'un confort.

### D6 — Sources externes : adaptateurs désactivables

Chaque source (EMSC, NASA FIRMS, Open-Meteo) est un adaptateur avec identifiant, licence,
attribution, quota, synchronisation (retry + backoff, disjoncteur), et journal `api_sync_runs`.
Sans clé ou sans réseau, l'adaptateur est désactivé proprement et l'interface l'indique.
Un point chaud satellite n'est JAMAIS converti automatiquement en incendie confirmé.

### D7 — Notifications : outbox transactionnelle

Un trigger sur `alert_events` écrit dans `notification_outbox` dans la même transaction que le
changement. Un traitement serveur (route cron + déclenchement immédiat après modération) calcule
les destinataires avec PostGIS (`ST_DWithin` sur les lieux suivis), applique préférences, heures
silencieuses, anti-spam et déduplication, puis envoie (Expo Push, Web Push) et journalise.

### D8 — Référentiel géographique réel et traçable

Wilayas et communes issues d'OpenStreetMap (paquet `dz-geodata` 0.1.1, extrait Geofabrik du
17/10/2026, licence ODbL — attribution « © contributeurs OpenStreetMap »). Les villages (lieux-dits)
ne sont pas inclus dans ce jeu de données : l'utilisateur peut suivre une commune ou placer
lui-même son village sur la carte ; un script d'import OSM est prévu pour les villages.

### D9 — Carte : fond vectoriel configurable, repli sans tuiles

Le style de carte est une variable d'environnement (fournisseur autorisant l'usage commercial).
Si le fond ne charge pas, la carte bascule sur un fond simplifié (contours des communes en GeoJSON)
et continue d'afficher les événements. Pas de couche satellite sans fournisseur sous licence.

### D10 — Contournement ESLint 10 / eslint-plugin-react

`eslint-plugin-react` 7.37 appelle `context.getFilename` (supprimé dans ESLint 10) lors de la
détection automatique de version de React. La config mobile fixe `settings.react.version`.

### D11 — i18n maison partagée

Dictionnaires typés dans `@tamurt/shared/i18n` (français = référence). L'arabe est complet mais
« non relu » ; le kabyle est « provisoire » (quelques termes, repli sur le français) et affiché
comme tel. RTL : `dir="rtl"` côté web, style `direction` côté mobile.

### D12 — Aucune donnée fictive hors mode DÉMO

Le seed par défaut ne contient que des données de référence (géographie, catégories, sources,
paramètres). Les données de démonstration sont marquées `is_demo`, insérées uniquement par
`pnpm demo:seed`, masquées par la RLS hors mode démo et signalées « DÉMO » dans l'interface.

### D13 — Application mobile : même backend, logique partagée, carte native facultative

- Accès direct à Supabase avec la clé publiable (RLS) ; session dans le trousseau sécurisé
  (`expo-secure-store`, découpée en morceaux de 1 800 caractères), rafraîchie au premier plan.
- Normalisation des événements, codes d'erreur, plafonds, catégories et textes viennent de
  `@tamurt/shared` (identiques au web).
- MapLibre natif est chargé **à la demande** (`React.lazy`) seulement si le module est présent
  (`TurboModuleRegistry.get`) : l'application démarre dans Expo Go et bascule sur une liste.
- Données publiques mises en cache (AsyncStorage) avec leur date ; les données personnelles en
  cache sont effacées à la déconnexion. Signalements hors connexion : file locale idempotente
  (`p_client_id`), renvoyée au retour du réseau ; la photo n'est pas conservée hors ligne.
- Photo : ré-encodage JPEG (`expo-image-manipulator`, sans recopie des métadonnées) puis
  ré-encodage serveur obligatoire avant publication.

### D14 — Compatibilité des moteurs JavaScript (Hermes)

Les fonctions `Intl.PluralRules` et `Intl.RelativeTimeFormat` peuvent manquer selon le moteur :
`@tamurt/shared` utilise des replis (règles de pluriel fr/ar testées contre `Intl.PluralRules`,
date absolue à la place du temps relatif) pour éviter tout plantage au démarrage.

### D15 — Pas d'auto-modération ni d'auto-confirmation

Imposé en base (migration `…101200`) : un membre de l'équipe ou un partenaire ne peut ni valider
ni rejeter son propre signalement, ni relever le statut d'un événement auquel il a contribué, ni
l'appuyer par une vérification (`self_moderation_forbidden`).

### D16 — Tâches planifiées sans dépendre d'un plan payant

`vercel.json` (quotidien, compatible Hobby) + workflow GitHub Actions optionnel toutes les
10 minutes ; la notification immédiate après modération ne dépend d'aucun cron.
