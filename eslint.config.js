const { defineConfig } = require('eslint/config')

const expoConfig = require('eslint-config-expo/flat')
const parser = require('@typescript-eslint/parser')

const react = require('eslint-plugin-react')
const reactCompiler = require('eslint-plugin-react-compiler')

const reactNative = require('eslint-plugin-react-native')
const tseslint = require('@typescript-eslint/eslint-plugin')

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['build/**/*', '**/*.js'],
  },
  {
    languageOptions: {
      parser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      react,
      'react-compiler': reactCompiler,
      'react-native': reactNative,
      '@typescript-eslint': tseslint,
    },
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      'react/react-in-jsx-scope': 'off',
      '@typescript-eslint/no-unused-vars': ['warn'],
      'react/jsx-uses-react': 1,
      'arrow-body-style': ['error'],
      'react-compiler/react-compiler': 'error',
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'warn',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    files: ['src/**/*.ts', 'src/**/*.tsx'],
  },
])
