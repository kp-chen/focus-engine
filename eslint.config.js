import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // JSX transform doesn't need React in scope; this is a JS app, not TS.
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // Cosmetic for an inline-copy-heavy app; not worth churning every screen.
      'react/no-unescaped-entities': 'off',
      // Empty catch is an intentional pattern for best-effort audio teardown.
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // First-time-linted legacy app: hook issues are surfaced as warnings (a
      // ratchet-down backlog) while the highest-value ones get fixed by hand.
      // rules-of-hooks stays an error — those are always real bugs.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      // React Compiler diagnostics — surfaced as a backlog; this app doesn't run
      // the compiler. (immutability also flags the use-before-declare ordering
      // in the audio context that Phase 1 fixes by hand.)
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/purity': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['**/*.test.{js,jsx}', '**/vitest.setup.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    // Build tooling and Node scripts run under Node, not the browser.
    files: ['scripts/**/*.{js,mjs}', '*.config.{js,mjs}'],
    languageOptions: { globals: { ...globals.node } },
  },
];
