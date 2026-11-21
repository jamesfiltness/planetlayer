// ESLint for the whole repository: `npm run lint` from the top folder.
//
// It's here rather than in client/ and server/ because shared/ belongs to
// both. The rules are ESLint's recommended ones, which catch mistakes rather
// than enforce a style, plus React's rules of hooks for the client (and the
// rule that lets ESLint see a variable used only in JSX as used).
import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  { ignores: ['**/node_modules/', '**/dist/', 'shared/*.d.ts'] },

  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    rules: {
      // Express knows error middleware by its four parameters, so an unused
      // `next` has to stay. A leading underscore, or a name in this list,
      // marks an argument as deliberately unused.
      'no-unused-vars': ['error', { argsIgnorePattern: '^(_|next$|req$)', caughtErrors: 'none' }],
    },
  },

  // The server, its tests, shared code and scripts run in Node.
  {
    files: ['server/**/*.js', 'shared/**/*.js', 'scripts/**/*.mjs', '*.js'],
    languageOptions: { globals: globals.node },
  },

  // The client runs in the browser, and its components are JSX.
  {
    files: ['client/**/*.{js,jsx}'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      'react/jsx-uses-vars': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    files: ['client/vite.config.js', 'client/**/*.test.{js,jsx}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
