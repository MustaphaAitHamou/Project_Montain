# Déploiement — application mobile (Expo / EAS)

> Rien n'a été compilé sur EAS ni publié : ces étapes nécessitent un compte Expo, et la
> publication sur les stores nécessite un compte Apple Developer (payant) et Google Play
> Console (frais d'inscription). **Aucune publication sans votre validation explicite.**

## 1. Pourquoi un « development build »

La carte utilise MapLibre natif (`@maplibre/maplibre-react-native`), absent d'Expo Go.
Dans Expo Go, l'application fonctionne mais affiche les événements **en liste** et le choix de
position se fait par GPS ou par recherche de commune (la carte est remplacée par un avis).

## 2. Initialisation

```bash
pnpm dlx eas-cli@latest login
```

```bash
cd apps/mobile && pnpm dlx eas-cli@latest init
```

`eas init` crée le projet et fournit l'identifiant à placer dans `EAS_PROJECT_ID` (lu par
`app.config.ts`, indispensable aux notifications push).

## 3. Profils de build (`apps/mobile/eas.json`)

| Profil        | Usage                                                        |
| ------------- | ------------------------------------------------------------ |
| `development` | Client de développement (carte native, rechargement à chaud) |
| `preview`     | APK / build interne pour testeurs                            |
| `production`  | Builds destinés aux stores (numéro de build auto-incrémenté) |

```bash
cd apps/mobile && pnpm dlx eas-cli@latest build --profile development --platform android
```

## 4. Notifications push

- Android : fournir les identifiants FCM (fichier de compte de service) dans expo.dev →
  Credentials. iOS : clé APNs (compte Apple Developer).
- Canaux Android créés par l'application : « Alertes » et « Alertes critiques ».
- Le serveur envoie via l'API Expo Push (`exp.host`) ; si « Enhanced security for push » est
  activé sur le projet, définissez `EXPO_ACCESS_TOKEN` côté serveur.
- Le jeton n'est demandé qu'après une action de l'utilisateur (Profil → Préférences de
  notification) ; il est désactivé à la déconnexion.

## 5. Permissions déclarées

Localisation « pendant l'utilisation » seulement (arrière-plan **bloqué** explicitement sur
Android et désactivé sur iOS), appareil photo et photothèque (photo facultative d'un
signalement), notifications. Textes d'explication en français dans `app.config.ts` ; à traduire
avant publication (fichiers de localisation natifs).

## 6. Avant soumission aux stores

Icône et écran de démarrage définitifs, fiches de store (fr/ar), politique de confidentialité
publiée (URL), questionnaire « Data safety » (Google) et « App Privacy » (Apple) cohérents avec
`docs/security/data-retention.md`, tests sur appareils réels Android et iOS.
