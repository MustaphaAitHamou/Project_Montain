// Expo configure automatiquement Metro pour les monorepos (workspaces pnpm).
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
