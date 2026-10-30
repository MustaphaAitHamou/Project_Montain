# Sources de données

Toutes les sources externes sont **désactivées par défaut** (`alert_sources.enabled = false`).
Leur activation est une décision de l'administrateur (licence, usage commercial, quotas), prise
depuis **Administration → Sources externes**. Une source sans clé requise ou en panne est ignorée
proprement et son état est visible dans l'administration (dernier succès, erreurs, disjoncteur).

> ⚠️ Dans l'environnement de développement de ce projet, les hôtes des API externes étaient
> **bloqués par la politique réseau**. Les adaptateurs ont été écrits d'après la documentation
> officielle et testés sur des **extraits synthétiques** reproduisant les formats documentés
> (`packages/server/src/sources/sources.test.ts`). Leur fonctionnement en conditions réelles
> **n'a pas été vérifié** : faites un essai depuis l'administration (« Synchroniser maintenant »)
> après déploiement.

## Récapitulatif

| Source                    | Données                                    | Clé                         | Licence / conditions (à faire valider)                                                                 | Statut affiché                                         |
| ------------------------- | ------------------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Communauté Tamurt Alerte  | Signalements vérifiés                      | —                           | Conditions d'utilisation de l'application                                                              | Selon la modération                                    |
| EMSC-CSEM (FDSN)          | Séismes (magnitude, profondeur, heure UTC) | Aucune                      | Conditions EMSC — vérifier l'usage commercial avant activation                                         | « Réseau sismologique »                                |
| NASA FIRMS                | Anomalies thermiques VIIRS (points chauds) | `NASA_FIRMS_MAP_KEY`        | Données ouvertes NASA, citation demandée                                                               | « Observation satellite » — **jamais** un feu confirmé |
| Open-Meteo                | Prévisions (pluie, rafales, températures)  | `OPEN_METEO_API_KEY` (opt.) | API gratuite **non commerciale** ; offre commerciale avec clé ; données CC BY 4.0                      | « Prévision météorologique (modèle) »                  |
| OpenStreetMap (Geofabrik) | Wilayas, communes, contours (référentiel)  | —                           | ODbL 1.0 — attribution « © contributeurs OpenStreetMap » obligatoire, partage à l'identique de la base | Référentiel, pas une alerte                            |

Aucune donnée officielle de l'État (protection civile, ONM) n'est intégrée : aucune API publique
documentée n'a été identifiée. L'interface l'indique (« Aucune vigilance météorologique officielle
n'est intégrée pour le moment ») au lieu d'inventer une source.

## EMSC — séismes

- Point d'accès : `https://www.seismicportal.eu/fdsnws/event/1/query` (format texte FDSN).
- Requête limitée à l'emprise de la Kabylie élargie, magnitude ≥ `minMagnitude` (2,5 par défaut),
  fenêtre `lookbackHours` (72 h). Toutes les secousses sont enregistrées comme observations
  (couche « Séismes ») ; à partir de `eventMinMagnitude` (3,0), un événement public
  « Confirmé par une source habilitée » est créé avec une gravité déduite de la magnitude :
  « Vigilance » de M 3,0 à 4,4, « Important » à partir de M 4,5 — **jamais « Critique »
  automatiquement** (réservé à une décision humaine de l'équipe de modération).
- Chaque fiche rappelle que les séismes ne peuvent pas être prédits (données a posteriori).
- Déduplication par identifiant EMSC (`external_source_id`, `external_ref`).
- Activation : Administration → Sources externes → EMSC → Activer.

## NASA FIRMS — points chauds satellites

- Clé : demander une **MAP_KEY** gratuite sur <https://firms.modaps.eosdis.nasa.gov/api/map_key/>,
  puis la définir **côté serveur uniquement** : variable `NASA_FIRMS_MAP_KEY` (Vercel → Project →
  Settings → Environment Variables, type « Sensitive »). Elle n'est jamais envoyée au navigateur ni
  à l'application mobile.
- Produits : VIIRS S-NPP, NOAA-20, NOAA-21 (NRT), `dayRange` = 1 jour, zone = emprise de la Kabylie.
- Quota documenté par la NASA : nombre de transactions par tranche de 10 minutes et par clé ;
  l'intervalle de synchronisation (30 min) reste très en dessous.
- Affichage : couche « Points chauds satellites », avec l'avertissement « Une anomalie thermique
  détectée par satellite n'est pas un incendie confirmé ». Un point chaud ne crée **jamais**
  d'événement ni de notification à lui seul.
- Recoupement automatique : un point chaud situé à moins de 3 km d'un événement « incendie » actif
  est ajouté à l'historique de vérification de cet événement avec le verdict « non concluant »
  (« indice, pas une confirmation ») ; il ne modifie ni le statut ni la gravité.

## Open-Meteo — prévisions

- Sans clé : `https://api.open-meteo.com/v1/forecast` — **usage non commercial uniquement**.
- Avec `OPEN_METEO_API_KEY` : `https://customer-api.open-meteo.com/v1/forecast` (offre commerciale).
- Points interrogés : centroïdes des communes (40 au maximum par passage, RPC `commune_points`).
- Seuils (`config.thresholds`) : précipitations ≥ 10 mm/h, rafales ≥ 80 km/h, température
  ≥ 40 °C ou ≤ −2 °C. Un dépassement crée une observation « Prévision météorologique », jamais
  une vigilance officielle.

## Robustesse des synchronisations

Implémentation : `packages/server/src/sources/runner.ts`.

- Tentatives avec délai exponentiel sur erreurs réseau / HTTP 5xx / 429.
- **Disjoncteur** : après 5 échecs consécutifs, la source est suspendue 15 min, durée doublée à
  chaque nouvel échec (6 h au maximum) ; remis à zéro au premier succès.
- Journal de chaque passage dans `api_sync_runs` (durée, nombre d'éléments, erreur).
- Déduplication par référence externe ; les observations anciennes sont purgées
  (voir `docs/security/data-retention.md`).
- Déclenchement : route `GET|POST /api/cron/sources` (voir `docs/deployment/vercel.md`) ou bouton
  « Synchroniser maintenant » dans l'administration.

## Mode DÉMO

Les données de démonstration sont **fictives**, marquées `is_demo = true` et préfixées « [DÉMO] » :

```bash
pnpm demo:seed
```

```bash
pnpm demo:clear
```

- Les scripts refusent toute instance non locale, sauf instance de démonstration dédiée confirmée
  explicitement (`--remote-demo-host=<hôte exact>`).
- Les événements DÉMO ne sont visibles que si le réglage `demo_mode` est activé, n'entrent jamais
  dans l'outbox et ne déclenchent aucune notification (vérifié).
- Côté web, `NEXT_PUBLIC_DEMO_MODE=true` affiche le bandeau DÉMO. **Jamais en production.**

## Villages (référentiel OSM) — plan d'import

Le référentiel livré contient les 6 wilayas et 289 communes de la zone (Tizi Ouzou, Béjaïa,
Bouira, Boumerdès, Bordj Bou Arréridj, Sétif), extraits d'OpenStreetMap via `dz-geodata`
(Geofabrik, ODbL). Les **villages** OSM ne sont pas encore importés. En attendant :

- un utilisateur peut suivre une commune, ou placer un **lieu personnalisé** sur la carte ;
- en cochant « Proposer aussi ce lieu comme village du référentiel », il crée une proposition
  (`propose_village`, statut `pending_review`) visible de lui seul et de l'équipe ;
- un modérateur la valide ou la rejette dans **Administration → Villages** (`review_village`) ;
  validée (`status = 'active'`), elle devient cherchable par tous. Chaque étape est journalisée
  (`village.proposed`, `village.reviewed`) — couvert par `tests/integration/src/villages.test.ts`.

Import OSM prévu (non exécuté : l'API Overpass était inaccessible depuis l'environnement de
développement) :

1. Requête Overpass sur l'emprise de chaque wilaya : `node["place"~"village|hamlet|isolated_dwelling"]`.
2. Conservation de `name`, `name:fr`, `name:ar`, `name:kab`, `alt_name` et de la position.
3. Rattachement à la commune par `private.commune_at(location)` (contours déjà en base).
4. Insertion dans `public.villages` : `source = 'osm'`, `source_ref = 'node/<id>'`,
   `status = 'active'`, `name_kab`, `alt_names` ; `search_name` est calculé automatiquement
   (`private.normalize_place_name`, insensible aux accents et aux graphies kabyles).
   La contrainte `unique (source, source_ref)` rend l'import rejouable sans doublon.
5. Réimport périodique sans toucher aux villages proposés par la communauté (`source = 'community'`).
