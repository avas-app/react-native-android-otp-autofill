import { fixupConfigRules } from '@eslint/compat'
import { FlatCompat } from '@eslint/eslintrc'
import js from '@eslint/js'
import prettier from 'eslint-plugin-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import { defineConfig } from 'eslint/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
})

export default defineConfig([
  {
    extends: fixupConfigRules(compat.extends('@react-native', 'prettier')),
    plugins: { prettier },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'prettier/prettier': 'error',
      'no-console': 'warn',
    },
  },
  {
    // React Compiler rules, as errors.
    rules: Object.fromEntries(
      Object.keys(reactHooks.configs.recommended.rules)
        .filter((rule) => !rule.endsWith('exhaustive-deps'))
        .map((rule) => [rule, 'error']),
    ),
  },
  {
    ignores: ['node_modules/', 'lib/', 'example/android/', '**/*.js'],
  },
])
