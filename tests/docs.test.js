import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { GLOSSARY } from '../src/glossary.js';

const root = path.join(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const count = Object.keys(GLOSSARY).length;

// 用語数は、ストアの説明文・README・辞書の手引きに数字として書いてある。
// 辞書を増やしたときに直し忘れると、事実と違う説明のまま公開してしまう。
// （実際に「約110語」と書いたまま 208 語になっていたことがある）
const FILES_WITH_COUNT = [
  'README.md',
  'SUBMISSION_GUIDE.md',
  'docs/GLOSSARY.md',
  'manifest.json',
];

describe('用語数の表記', () => {
  it.each(FILES_WITH_COUNT)('%s に書かれた語数が辞書と一致する', (file) => {
    const text = read(file);
    const numbers = [...text.matchAll(/(\d+)\s*語/g)].map((m) => Number(m[1]));
    expect(numbers.length, `${file} に「N 語」の記述が見当たらない`).toBeGreaterThan(0);
    for (const n of numbers) {
      expect(n, `${file} の「${n} 語」が辞書の ${count} 語と違う`).toBe(count);
    }
  });

  it('CHANGELOG は過去の記録なので検査しない', () => {
    // 0.1.0 時点の語数は、辞書が増えても 0.1.0 の記録としては正しい
    expect(fs.existsSync(path.join(root, 'CHANGELOG.md'))).toBe(true);
  });
});

describe('ストアの掲載文面', () => {
  const guide = read('SUBMISSION_GUIDE.md');
  const manifest = JSON.parse(read('manifest.json'));

  it('概要（短い説明）が 132 文字に収まっている', () => {
    const summary = guide.match(/\|\s*概要（132文字以内）\s*\|\s*(.+?)\s*\|/)?.[1];
    expect(summary, '提出ガイドから概要を読み取れない').toBeTruthy();
    expect(summary.length).toBeLessThanOrEqual(132);
  });

  it('manifest の説明も 132 文字に収まっている', () => {
    expect(manifest.description.length).toBeLessThanOrEqual(132);
  });

  it('詳細説明にソースコードの URL が載っている', () => {
    expect(guide).toContain('https://github.com/kanade0525/github-ja-guide');
  });

  it('詳細説明が権限とプライバシーに触れている', () => {
    for (const phrase of ['storage', '外部サーバーとの通信は一切ありません', 'github.com 上だけ']) {
      expect(guide, `掲載文面に「${phrase}」が無い`).toContain(phrase);
    }
  });
});

// ストアには「外部サーバーとの通信は一切ありません」と書いて審査を受ける。
// うっかり通信コードを足したら、説明と実装が食い違ったまま公開してしまう。
describe('外部送信なしの保証', () => {
  const SHIPPED = [
    'src/content.js',
    'src/dom.js',
    'src/glossary.js',
    'src/match.js',
    'src/settings.js',
    'popup.js',
    'options.js',
  ];

  const FORBIDDEN = [
    [/\bfetch\s*\(/, 'fetch'],
    [/XMLHttpRequest/, 'XMLHttpRequest'],
    [/\bWebSocket\b/, 'WebSocket'],
    [/sendBeacon/, 'navigator.sendBeacon'],
    [/\beval\s*\(/, 'eval'],
    [/new\s+Function\s*\(/, 'new Function'],
    [/import\s*\(/, '動的 import'],
  ];

  it.each(SHIPPED)('%s に通信・動的コード実行が含まれない', (file) => {
    const code = read(file);
    for (const [pattern, label] of FORBIDDEN) {
      expect(pattern.test(code), `${file} に ${label} が含まれている`).toBe(false);
    }
  });

  it('配布物に scripts/ を含めない（cws.mjs は fetch を使うため）', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.scripts.pack).not.toContain('scripts/');
    expect(pkg.scripts.pack).not.toContain('src/');
  });
});
