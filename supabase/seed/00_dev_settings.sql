-- Seed de DÉVELOPPEMENT LOCAL uniquement (exécuté par `supabase db reset`, jamais en production).
-- Aucune alerte n'est créée ici : les données de démonstration passent par `pnpm demo:seed`.

-- En local, le MFA administrateur n'est pas exigé (le serveur local n'a pas de TOTP configuré).
update public.app_settings set value = 'false' where key = 'require_admin_mfa';
