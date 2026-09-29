export default [
  {
    input: 'src/content.js',
    output: { file: 'content.js', format: 'iife' },
  },
  {
    // 拡張機能に同梱する読み物ページ（guide.html）用
    input: 'src/guide.js',
    output: { file: 'guide.bundle.js', format: 'iife' },
  },
];
