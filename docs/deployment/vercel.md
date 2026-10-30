# Déploiement — site web (Vercel) et tâches planifiées

> Rien n'a été déployé. Ces étapes nécessitent votre compte Vercel ; le plan payant n'est requis
> que pour des tâches planifiées fréquentes (voir plus bas).

## 1. Projet

1. vercel.com → Add New → Project → importer le dépôt Git.
2. **Root Directory** : `apps/web` (Vercel détecte le monorepo pnpm et installe depuis la racine).
3. Framework : Next.js (détecté). Node.js 22.
4. Variables d'environnement : voir `docs/deployment/environment.md`. Marquez les secrètes comme
   « Sensitive ». Production et Preview doivent pointer vers des projets Supabase **différents**.
5. Domaine : Settings → Domains, puis reportez l'URL dans `NEXT_PUBLIC_SITE_URL` et dans la
   configuration d'authentification Supabase.

## 2. Tâches planifiées

Deux routes protégées par `Authorization: Bearer <CRON_SECRET>` :

| Route                     | Rôle                                                      | Fréquence conseillée |
| ------------------------- | --------------------------------------------------------- | -------------------- |
| `/api/cron/sources`       | Synchronise les sources externes activées                 | 10 à 30 min          |
| `/api/cron/notifications` | Filet de sécurité de l'outbox + accusés de réception Expo | 5 à 10 min           |

Les notifications sont envoyées **immédiatement** après chaque décision de modération
(`after()` de Next.js) ; la tâche planifiée ne sert qu'à rattraper un envoi interrompu.

Trois options :

- **`apps/web/vercel.json`** (fourni) : exécution **quotidienne**, compatible avec le plan Hobby
  (qui n'autorise qu'un passage par jour). Vercel envoie automatiquement l'en-tête
  `Authorization: Bearer $CRON_SECRET` lorsque la variable `CRON_SECRET` est définie.
  Avec un plan Pro, remplacez les horaires par `*/10 * * * *` et `*/5 * * * *`.
- **GitHub Actions** (gratuit) : `.github/workflows/scheduled-sync.yml` appelle les deux routes
  toutes les 10 minutes (au mieux : GitHub peut retarder les exécutions planifiées). Il est
  **inactif** tant que vous ne définissez pas la variable de dépôt `CRON_BASE_URL`
  (ex. `https://alerte.example.org`) et le secret de dépôt `CRON_SECRET`.
- **Supabase `pg_cron` + `pg_net`** : possible, mais impose de stocker `CRON_SECRET` dans la base
  (Vault) ; non configuré.

## 3. Vérifications après déploiement

```bash
curl -fsS https://<domaine>/api/health
```

Puis : inscription + e-mail de confirmation reçu, signalement test (puis rejet), page
`/admin/sources` (état des sources), en-têtes de sécurité (`curl -I`).
