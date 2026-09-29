// package.json と manifest.json のバージョンを揃えて更新する。
//   node scripts/set-version.mjs 0.2.0

import fs from 'fs';
import path from 'path';

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version || '')) {
  console.error('使い方: node scripts/set-version.mjs 0.2.0');
  process.exit(1);
}

const root = path.resolve(import.meta.dirname, '..');
for (const file of ['package.json', 'manifest.json']) {
  const p = path.join(root, file);
  const json = JSON.parse(fs.readFileSync(p, 'utf8'));
  const before = json.version;
  json.version = version;
  fs.writeFileSync(p, JSON.stringify(json, null, 2) + '\n');
  console.log(`${file}: ${before} → ${version}`);
}

console.log(`\n次の手順:
  1. CHANGELOG.md に変更点を書く
  2. git commit -am "v${version}"
  3. git tag v${version} && git push --follow-tags
     → タグを push すると CI が検証 → GitHub リリース作成 → ストアに下書きアップロード まで進みます
  4. 公開は GitHub の Actions から Release ワークフローを手動実行し、PUBLISH と入力`);
