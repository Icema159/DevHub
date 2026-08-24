import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const webFiles = ['apps/web/**/*.{ts,tsx}'];

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/build/**', '**/coverage/**', '**/.next/**', 'generated/prisma/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['*.{js,mjs,cjs}'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: webFiles,
    plugins: {
      ...react.configs.flat.recommended.plugins,
      ...reactHooks.configs.flat.recommended.plugins,
    },
    languageOptions: {
      ...react.configs.flat.recommended.languageOptions,
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      ...reactHooks.configs.flat.recommended.rules,
      'react/prop-types': 'off',
    },
  },
  {
    files: ['apps/api/**/*.ts', 'apps/worker/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
  eslintConfigPrettier,
);
