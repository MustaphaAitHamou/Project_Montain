-- =====================================================================
-- Droits finaux.
-- - Le rôle service (backend de confiance : routes serveur, tâches planifiées)
--   reçoit les droits nécessaires, la RLS étant contournée pour ce rôle.
-- - Les rôles API (anon, authenticated) perdent les privilèges inutiles
--   accordés par défaut (TRUNCATE, REFERENCES, TRIGGER).
-- =====================================================================

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

-- Fonctions privées utilisées par les politiques RLS ou appelées dans des
-- requêtes exécutées avec les droits de l'appelant.
grant execute on function private.commune_at(extensions.geography) to service_role;
grant execute on function private.is_staff() to service_role;
grant execute on function private.is_admin() to service_role;
grant execute on function private.has_role(public.app_role) to service_role;
grant execute on function private.demo_mode_enabled() to service_role;
grant execute on function private.apply_retention() to service_role;
