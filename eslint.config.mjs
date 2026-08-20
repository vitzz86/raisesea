import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Existing UI animation/effect patterns predate React Compiler. Keep the
      // correctness hook rules, but introduce compiler rules incrementally.
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/globals': 'off',
      'react-hooks/incompatible-library': 'off',
      'react-hooks/use-memo': 'off',
      'react-hooks/set-state-in-render': 'off',
      'react/no-unescaped-entities': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
      '@next/next/no-img-element': 'warn',
      'prefer-const': 'warn',
    },
  },
  globalIgnores([
    '.next/**',
    'node_modules/**',
    'outputs/**',
    'public/**',
    'docs/**',
    'content/**',
    'next-env.d.ts',
  ]),
])
