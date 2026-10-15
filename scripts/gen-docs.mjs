// src/concepts.js から、Issue まわりの文書を生成する。
//   npm run gen:docs
//
//   docs/ISSUE_WRITING.md          読み物（Issue 作成画面からリンクしている）
//   .github/ISSUE_TEMPLATE/*.md    このリポジトリの Issue 雛形
//
// 同じ雛形が「拡張機能が差し込むもの」「このリポジトリの Issue 画面」
// 「読み物」の 3 か所に出る。手で書き分けると必ずずれるので出どころを 1 つにする。

import fs from 'fs';
import path from 'path';
import { CONCEPTS } from '../src/concepts.js';

const ROOT = path.resolve(import.meta.dirname, '..');
export const OUT = path.join(ROOT, 'docs', 'ISSUE_WRITING.md');
export const TEMPLATE_DIR = path.join(ROOT, '.github', 'ISSUE_TEMPLATE');

export function issueConcept() {
  const c = CONCEPTS.find((x) => x.id === 'issue');
  if (!c) throw new Error('concepts.js に issue の項目がありません');
  return c;
}

/** GitHub の Issue 雛形（front matter + 案内 + 本文） */
export function renderTemplate(t) {
  return [
    '---',
    `name: ${t.label}`,
    `about: ${t.about}`,
    "title: ''",
    `labels: ${t.labels}`,
    "assignees: ''",
    '---',
    '',
    '<!--',
    ...t.intro.map((line) => (line ? `  ${line}` : '')),
    '-->',
    '',
    t.body.trimEnd(),
    '',
  ].join('\n');
}

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

// 直接実行されたときだけ書き出す（テストからは render 系だけを使う）
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const text = render();
  fs.writeFileSync(OUT, text);
  console.log(`生成: docs/ISSUE_WRITING.md（${text.split('\n').length} 行）`);

  fs.mkdirSync(TEMPLATE_DIR, { recursive: true });
  for (const t of issueConcept().templates) {
    const file = path.join(TEMPLATE_DIR, t.file);
    fs.writeFileSync(file, renderTemplate(t));
    console.log(`生成: .github/ISSUE_TEMPLATE/${t.file}`);
  }
}
