const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'android/*', 'ios/*'],
  },
  {
    // eslint-plugin-react 7.37 ne sait pas détecter la version de React sous ESLint 10
    // (context.getFilename supprimé) : on la fixe explicitement.
    settings: { react: { version: '19.3' } },
    rules: {
      eqeqeq: ['error', 'always'],
    },
  },
]);
