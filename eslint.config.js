import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // ブラウザ
        document: 'readonly',
        window: 'readonly',
        MutationObserver: 'readonly',
        Node: 'readonly',
        NodeFilter: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        // Chrome 拡張
        chrome: 'readonly',
        // Node（設定ファイル・スクリプト・テスト）
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-cond-assign': ['error', 'except-parens'],
    },
  },
  {
    ignores: ['content.js', 'node_modules/', 'test-results/', 'coverage/', 'playwright-report/'],
  },
];
