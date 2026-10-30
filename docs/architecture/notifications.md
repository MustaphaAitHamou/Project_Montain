# Chaîne de notification

Objectif : prévenir les bonnes personnes (lieux suivis, catégories, gravité, préférences) sans
jamais sur-alerter, ni présenter une information non vérifiée comme sûre. **La réception n'est
jamais garantie** et ces notifications ne sont pas des alertes gouvernementales officielles.

```text
alert_events (insert/update)
  └─ trigger (même transaction) ─► notification_outbox (pending)       [migrations …100300]
        ├─ après la décision de modération : after() de Next.js ─┐
        └─ filet de sécurité : /api/cron/notifications ──────────┴─► processOutbox()   [packages/server]
              ├─ version obsolète ? → ignorée (une seule notification par changement)
              ├─ notification_candidates(event) → utilisateurs dont un lieu suivi couvre l'événement
              │     (même commune, ou distance PostGIS ≤ rayon du lieu)
              ├─ decideDelivery() pour chaque candidat                    [packages/shared]
              ├─ user_notifications (boîte de réception, clé de dédup unique)
              └─ envois push : Expo (iOS/Android) et Web Push (VAPID)
                    └─ accusés Expo vérifiés plus tard ; jetons invalides désactivés
```

## Quand une notification est-elle produite ?

`notificationReasonFor(avant, après)` :

| Raison            | Condition                                              |
| ----------------- | ------------------------------------------------------ |
| `published`       | L'événement devient public (pas s'il est déjà terminé) |
| `status_upgraded` | Passage à « Recoupé » ou « Confirmé »                  |
| `severity_raised` | Gravité relevée                                        |
| `resolved`        | Fin d'incident (si l'utilisateur l'a demandé)          |

Les événements DÉMO, rejetés, archivés ou non publics ne produisent rien (contrôlé en base).

## Décision par destinataire (`decideDelivery`)

1. Le lieu suivi a les notifications activées et couvre la catégorie (liste vide = toutes).
2. Gravité ≥ seuil du lieu, sinon seuil général de l'utilisateur.
3. Information non vérifiée (« Reçu », « En cours de vérification ») : seulement si l'utilisateur
   l'a demandé, et **jamais au-delà de « Vigilance »** (plafond en base).
4. Mises à jour et fins d'incident : selon les préférences.
5. Heures silencieuses (fuseau de l'utilisateur) : seules les notifications « Critique » partent en
   push ; les autres restent dans la boîte de réception.
6. Anti-spam : au plus 6 push non critiques par heure et par utilisateur ; au-delà, boîte de
   réception uniquement.

Niveaux : Information, Vigilance, Important, Critique. « Critique » n'est possible qu'après une
confirmation par une source habilitée.

## Idempotence

Clé `événement:raison:version` unique par utilisateur : un rejeu de l'outbox ou un double
déclenchement (after() + cron) ne crée jamais de doublon (testé).

## Liens profonds

Données de la notification : `{ eventId, url }`. Web : `/alertes/<id>` ; mobile : ouverture de la
fiche `alerte/[id]` au toucher.
