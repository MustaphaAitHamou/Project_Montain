# Variables d'environnement

Modèle complet : [`.env.example`](../../.env.example). **Aucune valeur secrète ne doit être
versionnée.** Les valeurs `NEXT_PUBLIC_*` et `EXPO_PUBLIC_*` sont intégrées au code envoyé aux
navigateurs et téléphones : elles doivent rester publiques par nature.

## Web (Next.js — `apps/web`)

| Variable                                           | Portée                 | Obligatoire                | Où l'obtenir                                                                      |
| -------------------------------------------------- | ---------------------- | -------------------------- | --------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                         | Publique               | Oui                        | Supabase → Project Settings → API (local : `pnpm db:status`)                      |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`             | Publique               | Oui                        | Supabase → Project Settings → API Keys → « Publishable key » (`sb_publishable_…`) |
| `NEXT_PUBLIC_SITE_URL`                             | Publique               | Oui (prod)                 | URL publique du site, ex. `https://alerte.example.org`                            |
| `NEXT_PUBLIC_MAP_STYLE_URL`                        | Publique               | Non                        | Style MapLibre d'un fournisseur autorisant votre usage (vide = fond de repli)     |
| `NEXT_PUBLIC_MAP_EXTRA_ORIGINS`                    | Publique               | Si style                   | Origines des tuiles/glyphes à autoriser dans la CSP                               |
| `NEXT_PUBLIC_SATELLITE_TILES_URL` / `_ATTRIBUTION` | Publique               | Non                        | Fournisseur d'imagerie sous licence (laisser vide sinon)                          |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`                     | Publique               | Web Push                   | `npx web-push generate-vapid-keys`                                                |
| `NEXT_PUBLIC_DEMO_MODE`                            | Publique               | Non                        | `true` uniquement sur une instance de démonstration                               |
| `SUPABASE_SECRET_KEY`                              | **Secrète**            | Oui                        | Supabase → API Keys → « Secret key » (`sb_secret_…`) — contourne la RLS           |
| `CRON_SECRET`                                      | **Secrète**            | Oui                        | Chaîne aléatoire ≥ 32 caractères (`openssl rand -hex 32`)                         |
| `NASA_FIRMS_MAP_KEY`                               | **Secrète**            | Pour FIRMS                 | <https://firms.modaps.eosdis.nasa.gov/api/map_key/> (gratuite)                    |
| `OPEN_METEO_API_KEY`                               | **Secrète**            | Usage commercial           | Offre commerciale Open-Meteo (sans clé = usage non commercial seulement)          |
| `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`               | **Secrète** / publique | Web Push                   | Même commande que la clé publique ; sujet `mailto:` de contact                    |
| `EXPO_ACCESS_TOKEN`                                | **Secrète**            | Si sécurité push renforcée | expo.dev → Account settings → Access tokens                                       |
| `REQUIRE_ADMIN_MFA`                                | Serveur                | Non                        | `true` par défaut en production ; `false` seulement en local                      |

## Mobile (Expo — `apps/mobile`)

| Variable                               | Obligatoire  | Remarque                                                     |
| -------------------------------------- | ------------ | ------------------------------------------------------------ |
| `EXPO_PUBLIC_SUPABASE_URL`             | Oui          | Même projet Supabase que le web                              |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Oui          | Clé **publiable** uniquement — jamais la clé secrète         |
| `EXPO_PUBLIC_SITE_URL`                 | Oui          | Liens vers le site (confidentialité, export, partage)        |
| `EXPO_PUBLIC_MAP_STYLE_URL`            | Non          | Vide = fond de repli (contours des communes)                 |
| `EXPO_PUBLIC_DEMO_MODE`                | Non          | `true` uniquement pour une démonstration                     |
| `EAS_PROJECT_ID`                       | Pour le push | Créé par `eas init` ; requis pour obtenir un jeton Expo Push |

Sur EAS, définissez-les par profil (`eas env:create` ou expo.dev → Project → Environment
variables) ; les valeurs `EXPO_PUBLIC_*` sont incorporées au moment du build.

## Tests (CI ou local)

Les tests d'intégration et e2e lisent la pile Supabase **locale** (`supabase status`) ou
`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_DB_URL`,
`MAILPIT_URL`. Ils refusent de cibler une instance qui n'est pas locale (e2e).
