# Tamurt Alerte

> **Veillons ensemble sur notre terre.** — une application de Tamurt Services.

Application communautaire de surveillance et d'information géolocalisée pour la Kabylie (Algérie)
et sa diaspora : carte des événements, signalements vérifiés, suivi de « Mes villages »,
notifications ciblées, sources externes (séismes, points chauds satellites, météo) et modération.

> ⚠️ Tamurt Alerte **n'est pas un service officiel de secours** et ne garantit pas une alerte
> immédiate. En cas de danger, suivez les consignes des autorités et des services de secours.

## Structure

| Dossier           | Contenu                                                                  |
| ----------------- | ------------------------------------------------------------------------ |
| `apps/web`        | Site web Next.js 16 (public, espace connecté, administration, API)       |
| `apps/mobile`     | Application iOS/Android Expo SDK 58                                      |
| `packages/shared` | Domaine métier, schémas Zod, i18n (fr/kab/ar), thème, règles partagées   |
| `packages/server` | Code serveur : sources externes, synchronisation, envoi de notifications |
| `supabase`        | Migrations PostgreSQL/PostGIS, RLS, seed de référence                    |
| `tests`           | Tests d'intégration (base réelle)                                        |
| `docs`            | Architecture, API, déploiement, sécurité, sources de données             |

Voir [ARCHITECTURE.md](./ARCHITECTURE.md) (décisions) et [PROGRESS.md](./PROGRESS.md) (avancement).

## Prérequis

- Node.js ≥ 22.12 et pnpm ≥ 10 (`corepack enable`)
- Docker (pour Supabase local)
- Pour le mobile sur appareil : Android Studio et/ou Xcode, ou un compte Expo (EAS)

## Démarrage rapide (local)

```bash
pnpm install
```

```bash
pnpm db:start
```

`pnpm db:status` affiche l'URL de l'API et la clé publiable locales. Copiez `.env.example` vers
`apps/web/.env.local` et renseignez `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` et (serveur) `SUPABASE_SECRET_KEY`.

```bash
pnpm dev:web
```

Le site est servi sur http://localhost:3000. Les e-mails d'authentification locaux sont visibles
dans Mailpit : http://127.0.0.1:54324.

```bash
pnpm dev:mobile
```

Pour le mobile, créez `apps/mobile/.env` avec `EXPO_PUBLIC_SUPABASE_URL`,
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` et `EXPO_PUBLIC_SITE_URL` (depuis un téléphone, utilisez
l'adresse IP de votre ordinateur au lieu de `127.0.0.1`). Dans Expo Go, la carte native est
remplacée par une liste ; pour la carte, utilisez un build de développement
(`docs/deployment/mobile-eas.md`).

Données de démonstration (fictives, marquées DÉMO, instance locale uniquement) :

```bash
pnpm demo:seed
```

```bash
pnpm demo:clear
```

## Vérifications

```bash
pnpm check
```

(`format:check` + `lint` + `typecheck` + tests unitaires). Voir aussi `pnpm build`,
`pnpm build:mobile:bundle`, `pnpm test:integration`, `pnpm test:e2e`.

## Documentation

| Sujet                        | Document                                                                 |
| ---------------------------- | ------------------------------------------------------------------------ |
| Décisions d'architecture     | [ARCHITECTURE.md](./ARCHITECTURE.md)                                     |
| Chaîne de notification       | [docs/architecture/notifications.md](docs/architecture/notifications.md) |
| API (routes, fonctions SQL)  | [docs/api/README.md](docs/api/README.md)                                 |
| Sources de données, licences | [docs/data-sources.md](docs/data-sources.md)                             |
| Variables d'environnement    | [docs/deployment/environment.md](docs/deployment/environment.md)         |
| Déploiement Supabase         | [docs/deployment/supabase.md](docs/deployment/supabase.md)               |
| Déploiement web (Vercel)     | [docs/deployment/vercel.md](docs/deployment/vercel.md)                   |
| Mobile (EAS, push, stores)   | [docs/deployment/mobile-eas.md](docs/deployment/mobile-eas.md)           |
| Sécurité                     | [SECURITY.md](./SECURITY.md), [modèle](docs/security/security-model.md)  |
| Conservation des données     | [docs/security/data-retention.md](docs/security/data-retention.md)       |

## Données et licences

- Référentiel administratif (wilayas, communes) : © contributeurs OpenStreetMap, licence ODbL
  (via `dz-geodata`). Voir `docs/data-sources.md`.
- Icônes : Lucide (ISC).
