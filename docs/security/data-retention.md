# Conservation et suppression des données

Principe : ne collecter que le nécessaire et ne rien garder plus longtemps qu'utile.
Les règles ci-dessous sont **appliquées automatiquement** par `private.apply_retention()`
(migration `20261030100700_retention.sql`), planifiée chaque nuit à 03:17 UTC par `pg_cron`
lorsque l'extension est disponible (c'est le cas sur Supabase). Exécution manuelle :
`select private.apply_retention();` (renvoie le nombre de lignes traitées par règle).

> Les durées sont des propositions de départ. Elles doivent être validées par le responsable du
> traitement (et un juriste) avant la mise en production, puis reportées dans la politique de
> confidentialité publiée.

## Données personnelles collectées

| Donnée                                   | Finalité                            | Remarque                                                         |
| ---------------------------------------- | ----------------------------------- | ---------------------------------------------------------------- |
| Adresse e-mail, mot de passe (haché)     | Compte                              | Gérés par Supabase Auth ; **aucun numéro de téléphone** demandé  |
| Nom affiché (facultatif), langue         | Affichage, langue des notifications |                                                                  |
| Lieux suivis (commune, village ou point) | Ciblage des notifications           | Aucune géolocalisation continue ; point choisi par l'utilisateur |
| Jetons push (Expo, Web Push)             | Envoi des notifications             | Désactivés à la déconnexion ; supprimés après inactivité         |
| Signalements (texte, position, photo)    | Information communautaire           | Position du **phénomène**, pas du téléphone ; EXIF supprimé      |
| Journaux d'audit (actions de modération) | Traçabilité, sécurité               | Accès réservé à l'administration                                 |

La position du téléphone n'est jamais enregistrée par l'application : elle ne sert, à la demande,
qu'à centrer la carte ou à proposer un point de départ.

## Durées de conservation appliquées

| Donnée                                               | Règle                                                                                   |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Événements terminés                                  | Archivés (retirés de la carte en direct) 30 jours après la fin                          |
| Signalements rejetés ou retirés                      | Texte effacé, auteur dissocié, position ramenée au centre de la commune après 180 jours |
| Observations externes non rattachées : points chauds | Supprimées après 30 jours                                                               |
| Observations externes : prévisions météo             | Supprimées après 7 jours                                                                |
| Observations externes : séismes                      | Supprimées après 365 jours                                                              |
| Journal des synchronisations (`api_sync_runs`)       | 30 jours                                                                                |
| Outbox des notifications traitée                     | 30 jours                                                                                |
| Remises de notifications (`notification_deliveries`) | 90 jours                                                                                |
| Boîte de réception (`user_notifications`)            | 180 jours                                                                               |
| Jetons push désactivés / inactifs                    | Supprimés 30 jours après désactivation, ou après 270 jours sans activité                |
| Annonces d'entraide fermées ou rejetées              | 180 jours                                                                               |
| Signalements de contenus traités (`abuse_reports`)   | 365 jours                                                                               |
| Journal d'audit (`audit_logs`)                       | 365 jours                                                                               |
| Médias rejetés (Storage)                             | Fichiers supprimés par le serveur lors du rejet                                         |

## Droits des personnes

- **Export** : Profil → Mes données → « Télécharger mes données » (route `GET /api/account/export`,
  fonction `export_my_data()` : profil, préférences, lieux suivis, signalements, notifications).
- **Suppression du compte** : Profil → « Supprimer mon compte » (mot de passe redemandé). Le compte,
  le profil, les lieux suivis, les préférences et les appareils sont supprimés ; les signalements
  sont **anonymisés** (auteur dissocié) car ils peuvent faire partie d'événements publics.
- **Rectification** : nom affiché et langue modifiables dans le profil ; un signalement en attente
  peut être modifié pendant 30 minutes ou retiré.
- Sur mobile, l'export et la suppression se font via le site web (lien depuis l'onglet Profil).

Le cadre légal applicable (loi algérienne n° 18-07 relative à la protection des personnes physiques
dans le traitement des données à caractère personnel ; RGPD pour les utilisateurs situés dans
l'Union européenne) doit être confirmé par un juriste avant la mise en production.
