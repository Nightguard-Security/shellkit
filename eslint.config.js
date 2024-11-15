const stylisticTs = require('@stylistic/eslint-plugin-ts');
const parserTs = require('@typescript-eslint/parser');
const typescriptPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
  {
    plugins: {
      '@stylistic/ts': stylisticTs,
      '@typescript-eslint': typescriptPlugin
    },
    languageOptions: {
      parser: parserTs,
      parserOptions: {
        ecmaVersion: 13,
        sourceType: "module",
        ecmaFeatures: {
          modules: true
        }
      }
    },
    rules: {
      '@stylistic/ts/indent': ['error', 2],
      "@stylistic/ts/quotes": ["error", "double"],
      "@stylistic/ts/semi": ["error", "always"]
      },
    files: [
      "src/**/*.ts"
    ],
  }
]
