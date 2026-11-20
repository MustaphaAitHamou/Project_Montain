# Avancement — Tamurt Alerte

Dernière mise à jour : 20/11/2026. Légende : ✅ terminé et vérifié · 🟡 fait mais non vérifiable ici
· ⛔ bloqué par un élément externe (clé, réseau, compte, appareil).

## Résultats de vérification (dernière exécution, environnement local)

| Vérification                                                  | Résultat                                                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `pnpm format:check` / `pnpm lint` / `pnpm typecheck`          | ✅ sans erreur (6 paquets)                                                                       |
| Tests unitaires (`pnpm test`)                                 | ✅ 93 : shared 60, server 22, mobile 8, web 3                                                    |
| Tests d'intégration sur base réelle (`pnpm test:integration`) | ✅ 67 (9 fichiers), dont la couverture nationale ; rejoués deux fois de suite sans réinitialiser |
| Lint SQL (`supabase db lint`, plpgsql_check)                  | ✅ aucune erreur dans `public` et `private` (avertissements internes à PostGIS seulement)        |
| Tests end-to-end Playwright (`pnpm test:e2e`)                 | ✅ 17 réussis (mobile + desktop), 3 ignorés à dessein (parcours complet joué une fois)           |
| Build web (`pnpm build`)                                      | ✅                                                                                               |
| Bundles mobiles Metro Android + iOS                           | ✅ (Hermes, 6,8 Mo chacun)                                                                       |
| Exécution sur appareil / émulateur mobile                     | ⛔ aucun appareil ni émulateur disponible                                                        |
| CI GitHub Actions                                             | ✅ passée sur `main` (16/11/2026) ; relancée à chaque push sur `main`                            |

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

- **Web, appliqué.** Rouge signal, blanc et noir. Polices Anton et Inter Tight, boutons à pans coupés avec socle noir, cartes à bande rouge. Logos, icônes et manifeste, bouton yaz. La rubalise rouge et blanche sous l'accueil a été retirée le 20/11/2026 (voir ci-dessous).
- **Vérifié** : typecheck, lint, Prettier, tests (shared 59, mobile 8, server 22, web 3), build. Axe WCAG A/AA sur 5 pages publiques, en clair et en sombre : 0 violation critique ou sérieuse.
- **Non relancés** : les E2E (`apps/web/e2e`). Ils exigent la pile Supabase locale, indisponible dans l'environnement de travail.
- **Mobile, en partie.** Les couleurs et les coins viennent du thème partagé. L'icône et l'icône adaptative Android viennent du kit, et les couleurs restantes (carte, notifications) sont alignées. Les polices Anton et Inter Tight ne sont pas encore chargées dans l'app Expo, et le rendu n'a pas été contrôlé sur appareil.
- **Slogan** : « Veillons ensemble sur notre terre » est conservé.

## Couverture nationale et refonte de l'accueil (20/11/2026) ✅ web · 🟡 mobile

- **Toute l'Algérie** : référentiel étendu aux 69 wilayas (découpage de 2025) et 1 538 communes
  OSM. Deux migrations additives : `20261120090000_coverage_algeria.sql` (région `algerie`,
  réglage `coverage`, fonctions de carte) et `20261120090100_geo_algeria_data.sql` (générée par
  `scripts/geo/build-seed.mjs --all --except … --region algerie`). Aucune donnée supprimée : la
  région `kabylie` est conservée, ses 6 wilayas sont rattachées à `algerie`.
- Aïn Defla (chef-lieu de la wilaya 44) n'a pas de code ONS dans l'extrait OSM : le script la
  complète avec son code officiel 4401 et échoue si une autre commune en manquait.
- `DEFAULT_REGION` = `ALGERIA_REGION` (web, mobile, serveur). Les signalements, lieux suivis et
  villages sont acceptés partout en Algérie (Alger, Tamanrasset testés) et refusés hors du pays
  (Tunis testé).
- **Séismes** : l'emprise interrogée déborde sur les voisins ; seuls les épicentres à moins de
  50 km du territoire deviennent des événements (`coverage_distance_km`, réservée au rôle
  service, testée avec un séisme fictif au nord du Maroc). **Météo** : 2 points par wilaya
  (`wilaya_forecast_points`) au lieu des 40 communes les plus peuplées, qui seraient à Alger.
- **Carte** : vue initiale sur tout le pays ; fond de repli = contours des wilayas (115 Ko),
  communes chargées au zoom 7 pour les seules wilayas visibles (vérifié autour d'Alger).
  Accueil : carte pleine largeur (jusqu'à 1 440 px) et haute (340 à 600 px), légende posée sur la
  carte en grand écran. Page Carte élargie.
- **Accueil** : rubalise retirée ; illustrations originales animées (l'Algérie sous un balayage
  radar dans le bandeau, village paisible pour « rien à signaler », village suivi avec cloche),
  catégories en tuiles. Animations coupées si l'utilisateur limite les mouvements. Vérifié en
  clair, en sombre et à 390 px (aucun débordement).
- **Textes** : « Kabylie » → « Algérie » (fr, ar), page À propos, README.
- **Vérifié** : format, lint, typecheck, tests unitaires (93), intégration (67), lint SQL, e2e
  (17 réussis, dont axe), build web, bundles Android et iOS.
- 🟡 **Mobile** : contours des wilayas et zoom minimal abaissé pour voir tout le pays. Le détail
  communal au zoom n'existe que sur le web. Non contrôlé sur appareil.
- **À savoir avant d'activer les sources** : au Sahara, les torchères pétrolières apparaîtront
  comme points chauds FIRMS (jamais comme événements) ; les seuils Open-Meteo (40 °C…) ont été
  fixés pour le Nord et devront être adaptés par zone climatique.

## Phase 2 — Backend ✅

15 migrations (toutes additives), RLS partout, `GRANT` explicites, fonctions `SECURITY DEFINER`,
outbox transactionnelle, rétention planifiée (pg_cron), référentiel OSM (69 wilayas,
1 538 communes, toute l'Algérie), stockage (quarantaine / public), audit.

## Phase 3 — Carte et signalements ✅ (fond de carte : 🟡)

- Carte MapLibre (web + mobile natif chargé à la demande), regroupement, filtres, recherche
  (graphies kabyles), géolocalisation sur demande, distinction communautaire / institutionnel /
  satellite / non vérifié, requêtes PostGIS.
- Signalement en 7 étapes, position du **phénomène** placée sur la carte (GPS = simple point de
  départ, position incertaine admise), photo ré-encodée (EXIF supprimé client + serveur), file
  hors ligne idempotente, limites (5/h, 20/j), doublons proches, retrait, contestation.
- Statuts et plafonds de gravité imposés en base ; **pas d'auto-modération ni
  d'auto-confirmation** (corrigé et testé dans cette phase).
- 🟡 Aucun fournisseur de tuiles configuré : fond de repli (contours des wilayas, puis des
  communes en zoomant). Le style distant est prêt (`NEXT_PUBLIC_MAP_STYLE_URL`,
  `EXPO_PUBLIC_MAP_STYLE_URL`).

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
- **Décisions** : activation de chaque source selon sa licence (voir torchères FIRMS et seuils
  Open-Meteo au Sahara) ; fournisseur de fond de carte ;
  relecture juridique des pages Confidentialité / Conditions ; vérification des numéros
  d'urgence ; relecture de l'arabe et traduction kabyle par des locuteurs natifs ; plan Vercel
  (tâches fréquentes) ; comptes Apple / Google pour les stores.
- Le code est sur GitHub (branche `main`) ; **aucun déploiement** n'a été effectué.
