# Avancement — Tamurt Alerte

Dernière mise à jour : 30/10/2026. Légende : ✅ terminé et vérifié · 🟡 fait mais non vérifiable ici
· ⛔ bloqué par un élément externe (clé, réseau, compte, appareil).

## Résultats de vérification (dernière exécution, environnement local)

| Vérification                                                  | Résultat                                                                                               |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `pnpm format:check` / `pnpm lint` / `pnpm typecheck`          | ✅ sans erreur (6 paquets)                                                                             |
| Tests unitaires (`pnpm test`)                                 | ✅ 92 : shared 59, server 22, mobile 8, web 3                                                          |
| Tests d'intégration sur base réelle (`pnpm test:integration`) | ✅ 65 (9 fichiers) : RLS, signalements, modération, villages, entraide, notifications, comptes, médias |
| Lint SQL (`supabase db lint`, plpgsql_check)                  | ✅ aucune erreur                                                                                       |
| Tests end-to-end Playwright (`pnpm test:e2e`)                 | ✅ 17 réussis (mobile + desktop), 3 ignorés à dessein (parcours complet joué une fois)                 |
| Build web (`pnpm build`)                                      | ✅                                                                                                     |
| Bundles mobiles Metro Android + iOS                           | ✅ (Hermes, 6,8 Mo chacun)                                                                             |
| Exécution sur appareil / émulateur mobile                     | ⛔ aucun appareil ni émulateur disponible                                                              |
| CI GitHub Actions                                             | 🟡 workflows écrits, jamais exécutés (aucun dépôt distant)                                             |

## Phase 0 — Audit et initialisation ✅

Monorepo pnpm (web, mobile, shared, server, tests), TypeScript strict, ESLint 10, Prettier,
Vitest, Playwright, Supabase local (Postgres 17 + PostGIS), CI.

## Phase 1 — Design system, i18n et écrans ✅ (mobile : 🟡 non exécuté sur appareil)

- Jetons de design partagés (couleurs de marque, contrastes testés ≥ 4,5:1), thèmes clair/sombre.
- i18n fr (référence), ar (complet, **non relu**), kab (**provisoire**, repli fr) ; RTL arabe ;
  avertissement de traduction affiché ; replis pour les moteurs JS sans `Intl.PluralRules`.
- Web : accueil (message prudent « Aucune alerte signalée dans les sources actuellement
  disponibles. »), carte, alertes, fiche, signaler, villages, profil, notifications, entraide,
  consignes, pages légales (brouillons), hors ligne. Accessibilité axe WCAG A/AA : 0 violation
  critique ou sérieuse (e2e).
- Mobile : onglets Accueil / Carte / Signaler / Alertes / Profil, onboarding, fiche d'alerte,
  Mes villages, notifications, préférences, mes signalements, sources, connexion / inscription /
  mot de passe oublié — reliés au vrai backend Supabase.

## Identité visuelle (DA Tamurt Services) ✅ web · 🟡 mobile

- **Web, appliqué.** Rouge signal, blanc et noir. Polices Anton et Inter Tight, boutons à pans coupés avec socle noir, cartes à bande rouge. Rubalise sous l'accueil, logos, icônes et manifeste, bouton yaz.
- **Vérifié** : typecheck, lint, Prettier, tests (shared 59, mobile 8, server 22, web 3), build. Axe WCAG A/AA sur 5 pages publiques, en clair et en sombre : 0 violation critique ou sérieuse.
- **Non relancés** : les E2E (`apps/web/e2e`). Ils exigent la pile Supabase locale, indisponible dans l'environnement de travail.
- **Mobile, en partie.** Les couleurs et les coins viennent du thème partagé. L'icône et l'icône adaptative Android viennent du kit, et les couleurs restantes (carte, notifications) sont alignées. Les polices Anton et Inter Tight ne sont pas encore chargées dans l'app Expo, et le rendu n'a pas été contrôlé sur appareil.
- **Slogan** : « Veillons ensemble sur notre terre » est conservé.

## Phase 2 — Backend ✅

13 migrations (toutes additives), RLS partout, `GRANT` explicites, fonctions `SECURITY DEFINER`,
outbox transactionnelle, rétention planifiée (pg_cron), référentiel OSM (6 wilayas,
289 communes), stockage (quarantaine / public), audit.

## Phase 3 — Carte et signalements ✅ (fond de carte : 🟡)

- Carte MapLibre (web + mobile natif chargé à la demande), regroupement, filtres, recherche
  (graphies kabyles), géolocalisation sur demande, distinction communautaire / institutionnel /
  satellite / non vérifié, requêtes PostGIS.
- Signalement en 7 étapes, position du **phénomène** placée sur la carte (GPS = simple point de
  départ, position incertaine admise), photo ré-encodée (EXIF supprimé client + serveur), file
  hors ligne idempotente, limites (5/h, 20/j), doublons proches, retrait, contestation.
- Statuts et plafonds de gravité imposés en base ; **pas d'auto-modération ni
  d'auto-confirmation** (corrigé et testé dans cette phase).
- 🟡 Aucun fournisseur de tuiles configuré : fond de repli (contours des communes). Le style
  distant est prêt (`NEXT_PUBLIC_MAP_STYLE_URL`, `EXPO_PUBLIC_MAP_STYLE_URL`).

## Phase 4 — Mes villages ✅

Suivi de communes, villages ou lieux personnalisés (diaspora sans GPS), rayon, catégories,
gravité minimale, historique, alertes actives ; proposition de village au référentiel avec revue
par la modération (branchée dans cette phase, testée).

## Phase 5 — Notifications 🟡

- ✅ Ciblage serveur (lieux suivis, rayon PostGIS, catégories, gravité, vérification, heures
  silencieuses, anti-spam, déduplication, mises à jour, fin d'incident), boîte de réception,
  notification in-app vérifiée de bout en bout (e2e), liens profonds.
- ⛔ Envoi push réel non vérifié : `exp.host` bloqué par le réseau de développement, pas
  d'appareil, pas de projet EAS (`EAS_PROJECT_ID`), pas de clés VAPID. Code des fournisseurs testé
  avec des réponses simulées.

## Phase 6 — Sources externes 🟡

Adaptateurs EMSC, NASA FIRMS, Open-Meteo avec retry/backoff, disjoncteur, journal, déduplication,
désactivation propre sans clé ; **désactivés par défaut**. ⛔ Hôtes bloqués par la politique
réseau de l'environnement : testés uniquement sur des extraits synthétiques au format documenté.

## Phase 7 — Administration et modération ✅

Tableau de bord, file de modération (filtres, recherche, pagination — ajoutés dans cette phase),
événements, médias, contestations, signalements de contenus, villages, entraide, utilisateurs et
rôles, sources, historique des notifications, audit, paramètres, MFA TOTP.

## Phase 8 — Entraide et améliorations ✅

Entraide modérée sans messagerie privée ni coordonnées personnelles, limitée dans le temps
(tests ajoutés dans cette phase : 5). Mode DÉMO séparé (`pnpm demo:seed` / `demo:clear`, instance
locale uniquement, invisible hors mode démo, sans notification — vérifié). Publicité : désactivée
(aucune intégration).

## Phase 9 — Tests et déploiement 🟡

Tests unitaires, intégration, e2e, CI (avec provisionnement e2e), documentation de déploiement
(Supabase, Vercel, EAS), `vercel.json`, `eas.json`, workflow de tâches planifiées.
**Aucun déploiement effectué** : il requiert vos comptes et décisions (voir ci-dessous).

## Blocages, décisions et éléments à fournir

- ⛔ **Réseau de l'environnement de développement** : `www.seismicportal.eu`,
  `firms.modaps.eosdis.nasa.gov`, `api.open-meteo.com`, `tiles.openfreemap.org`, `exp.host`,
  `download.geonames.org`, `overpass-api.de` refusés (HTTP 403). Pour les tester depuis un
  environnement cloud Claude : paramètres de l'environnement → accès réseau → domaines autorisés.
- **Clés** (côté serveur uniquement) : `NASA_FIRMS_MAP_KEY` (gratuite), `OPEN_METEO_API_KEY`
  (si usage commercial), clés VAPID (Web Push), `EAS_PROJECT_ID` (+ identifiants FCM / APNs) pour
  le push mobile, `CRON_SECRET`.
- **Décisions** : activation de chaque source selon sa licence ; fournisseur de fond de carte ;
  relecture juridique des pages Confidentialité / Conditions ; vérification des numéros
  d'urgence ; relecture de l'arabe et traduction kabyle par des locuteurs natifs ; plan Vercel
  (tâches fréquentes) ; comptes Apple / Google pour les stores.
- Le dépôt Git est local au conteneur (éphémère) : aucun commit ni dépôt distant à ce stade.
