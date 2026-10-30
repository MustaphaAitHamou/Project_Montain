# Déploiement — Supabase (base, authentification, stockage)

> Rien n'a été déployé : ces étapes nécessitent votre compte Supabase et engagent
> éventuellement des frais (le plan gratuit suffit pour un pilote ; vérifiez ses limites).

## 1. Créer le projet

1. <https://supabase.com/dashboard> → New project. Région proche des utilisateurs
   (ex. `eu-west-3` Paris ou `eu-central-1` Francfort pour l'Algérie et la diaspora européenne).
2. Notez le **Project ref**, l'URL de l'API, la clé publiable et la clé secrète
   (Project Settings → API Keys).

## 2. Appliquer les migrations

```bash
pnpm exec supabase login
```

```bash
pnpm exec supabase link --project-ref <project-ref>
```

```bash
pnpm exec supabase db push
```

`db push` applique les migrations de `supabase/migrations` dans l'ordre ; elles sont additives
(aucune suppression de données). Le fichier `supabase/seed/00_dev_settings.sql` est réservé au
local (il désactive le MFA administrateur) : **ne l'exécutez pas en production**.

Extensions utilisées : `postgis`, `pg_trgm`, `unaccent`, `pg_cron` (conservation nocturne).
Vérifiez dans Database → Extensions que `pg_cron` est activée ; sinon la purge doit être lancée
manuellement (`select private.apply_retention();`).

## 3. Authentification

Authentication → Settings / URL Configuration :

- **Site URL** : `https://<votre-domaine>`.
- **Redirect URLs** : `https://<votre-domaine>/**` et `tamurtalerte://**` (application mobile).
- Confirmation d'e-mail **activée** ; inscription par téléphone **désactivée** ; connexion anonyme
  désactivée.
- Mot de passe : 10 caractères minimum, lettres et chiffres (identique à `supabase/config.toml`).
- **MFA TOTP** activé (obligatoire pour l'administration).
- **SMTP personnalisé** (Authentication → Emails → SMTP) : indispensable en production, le service
  d'envoi par défaut est très limité.
- Modèles d'e-mails : reprendre `supabase/templates/confirmation.html` et `recovery.html` (liens
  `/auth/confirm?token_hash=…`).
- Recommandé : protection contre les mots de passe compromis (selon votre plan).

## 4. Stockage

Les buckets `report-media-quarantine` (privé) et `report-media-public` (public, copies
ré-encodées sans métadonnées) et leurs politiques sont créés par les migrations.

## 5. Premier administrateur

Créez votre compte depuis le site, confirmez l'e-mail, puis attribuez le rôle **une seule fois**
via l'éditeur SQL (les attributions suivantes se font depuis l'administration, journalisées) :

```sql
insert into public.user_roles (user_id, role, reason)
select id, 'admin', 'Premier administrateur' from auth.users where email = 'vous@example.org';
```

Activez ensuite la double authentification depuis `/admin/mfa`.

## 6. Réglages applicatifs

Administration → Paramètres (table `app_settings`) : `demo_mode` doit rester `false` en
production. Les sources externes restent désactivées tant que vous ne les activez pas
(voir `docs/data-sources.md`).
