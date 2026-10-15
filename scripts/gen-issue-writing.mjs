// docs/ISSUE_WRITING.md を src/concepts.js から生成する。
//   npm run gen:docs
//
// 同じ内容が「拡張機能のガイドページ」「Issue 画面の案内」「この手引き」の
// 3 か所に出る。手で書き分けると必ずずれるので、出どころを 1 つにする。

import fs from 'fs';
import path from 'path';
import { CONCEPTS } from '../src/concepts.js';

const ROOT = path.resolve(import.meta.dirname, '..');
export const OUT = path.join(ROOT, 'docs', 'ISSUE_WRITING.md');

export function render() {
const issue = CONCEPTS.find((c) => c.id === 'issue');
if (!issue) throw new Error('concepts.js に issue の項目がありません');

const lines = [
  '<!-- このファイルは scripts/gen-issue-writing.mjs が src/concepts.js から生成します。',
  '     直接編集せず、src/concepts.js を直して npm run gen:docs を実行してください。 -->',
  '',
  '# 伝わる依頼の書き方',
  '',
  issue.lead,
  '',
  '困っていることが同じでも、書き方ひとつで解決までの時間が変わります。',
  'ここに挙げるのは一般的な進め方です。完璧に埋める必要はありません。',
  '',
];

for (const section of issue.sections) {
  lines.push(`## ${section.heading}`, '');
  for (const p of section.paragraphs || []) lines.push(p, '');
  for (const item of section.list || []) lines.push(`- ${item}`);
  if (section.list) lines.push('');

  if (section.compare) {
    lines.push('| 伝わりにくい | 伝わりやすい |', '|---|---|');
    const rows = Math.max(section.compare.bad.length, section.compare.good.length);
    for (let i = 0; i < rows; i++) {
      lines.push(`| ${section.compare.bad[i] || ''} | ${section.compare.good[i] || ''} |`);
    }
    lines.push('');
  }
  if (section.note) lines.push(`> ${section.note}`, '');
}

lines.push('## そのまま使える雛形', '');
lines.push(
  'GitHub で Issue を新しく作ると、下の雛形が選べます。',
  'この拡張機能を入れていれば、書く欄のすぐ上にも同じものが出ます。',
  ''
);

for (const t of issue.templates || []) {
  lines.push(`### ${t.label}`, '', '```markdown', t.body.trimEnd(), '```', '');
}

return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}

// 直接実行されたときだけ書き出す（テストからは render() だけを使う）
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const text = render();
  fs.writeFileSync(OUT, text);
  console.log(`生成しました: docs/ISSUE_WRITING.md（${text.split('\n').length} 行）`);
}
