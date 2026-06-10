import tseslint from 'typescript-eslint'
import functional from 'eslint-plugin-functional'
import eslintComments from '@eslint-community/eslint-plugin-eslint-comments'

const limitsRules = {
  'max-params': ['error', 1],
  'max-lines-per-function': [
    'error',
    { max: 75, skipBlankLines: true, skipComments: true, IIFEs: true }
  ],
  'max-lines': ['error', { max: 250, skipBlankLines: true, skipComments: true }],
  'max-statements': ['error', 12],
  'max-depth': ['error', 3],
  complexity: ['error', 8],
  'max-nested-callbacks': ['error', 3],
  'max-classes-per-file': ['error', 1]
}

const noSuppressionRules = {
  '@eslint-community/eslint-comments/no-use': ['error', { allow: [] }],
  '@typescript-eslint/ban-ts-comment': [
    'error',
    {
      'ts-expect-error': true,
      'ts-ignore': true,
      'ts-nocheck': true,
      'ts-check': true
    }
  ]
}

const styleRules = {
  '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
  'no-var': 'error',
  'prefer-const': 'error',
  'no-console': 'error',
  'no-inline-comments': 'error',
  'line-comment-position': ['error', { position: 'above' }],
  'no-restricted-syntax': [
    'error',
    {
      selector: 'ExportDefaultDeclaration',
      message: 'No default exports. Use one named export at the end of the file.'
    },
    {
      selector: 'VariableDeclaration[kind="let"]',
      message: 'No let. Use const and immutable data.'
    }
  ]
}

const functionalRules = {
  'functional/no-let': 'error',
  'functional/no-loop-statements': 'error',
  'functional/no-throw-statements': 'error',
  'functional/no-classes': 'off',
  'functional/immutable-data': 'error',
  'functional/prefer-readonly-type': 'error',
  'functional/type-declaration-immutability': 'off',
  'functional/functional-parameters': 'off',
  'functional/no-expression-statements': 'off',
  'functional/no-conditional-statements': 'off',
  'functional/no-return-void': 'off',
  'functional/no-mixed-types': 'off',
  'functional/prefer-immutable-types': 'off'
}

const config = tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', '*.config.js', '*.config.ts']
  },
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    plugins: {
      functional,
      '@eslint-community/eslint-comments': eslintComments
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: { ...noSuppressionRules, ...styleRules, ...functionalRules }
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: limitsRules
  },
  {
    files: ['test/**/*.ts'],
    rules: {
      'functional/no-throw-statements': 'off',
      'functional/immutable-data': 'off'
    }
  }
)

export default config
