// Chrome ウェブストア API v1.1 との連携。
//
//   node scripts/cws.mjs status              下書き／公開中の状態を見る
//   node scripts/cws.mjs upload              dist.zip を下書きとしてアップロード（公開しない）
//   node scripts/cws.mjs publish --yes       下書きを公開する（取り消せない・要確認）
//   node scripts/cws.mjs publish --testers --yes   限定テスターにだけ公開する
//
// 認証情報は環境変数から読む。リポジトリにも、外部サービスにも貼らないこと。
//   CWS_CLIENT_ID / CWS_CLIENT_SECRET / CWS_REFRESH_TOKEN / CWS_EXTENSION_ID
// 取得手順は docs/RELEASE.md を参照。

import fs from 'fs';
import path from 'path';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/chromewebstore/v1.1';
const UPLOAD_API = 'https://www.googleapis.com/upload/chromewebstore/v1.1';

const ROOT = path.resolve(import.meta.dirname, '..');
const ZIP = path.join(ROOT, 'dist.zip');

const args = process.argv.slice(2);
const command = args[0];
const has = (flag) => args.includes(flag);

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    fail(
      `環境変数 ${name} が設定されていません。\n` +
      `  ローカル: 一時的に export するか direnv などで渡してください\n` +
      `  CI     : GitHub の Settings → Secrets に登録してください\n` +
      `  取得手順: docs/RELEASE.md`
    );
  }
  return value;
}

function fail(message) {
  console.error(`\nエラー: ${message}\n`);
  process.exit(1);
}

async function getAccessToken() {
  // 「デスクトップ アプリ」種別のクライアントにはシークレットが無い（公開クライアント）。
  // その場合は client_secret を送らない。
  const params = {
    client_id: requireEnv('CWS_CLIENT_ID'),
    refresh_token: requireEnv('CWS_REFRESH_TOKEN'),
    grant_type: 'refresh_token',
  };
  if (process.env.CWS_CLIENT_SECRET) params.client_secret = process.env.CWS_CLIENT_SECRET;
  const body = new URLSearchParams(params);

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const json = await res.json();
  if (!res.ok || !json.access_token) {
    // エラー本文に認証情報が混ざりうるので、種別だけを出す
    fail(`アクセストークンを取得できませんでした（${res.status} ${json.error || '不明'}）。` +
         ' リフレッシュトークンの期限切れか、クライアント情報の誤りが考えられます。');
  }
  return json.access_token;
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, 'x-goog-api-version': '2' };
}

async function status() {
  const token = await getAccessToken();
  const id = requireEnv('CWS_EXTENSION_ID');
  const res = await fetch(`${API}/items/${id}?projection=DRAFT`, { headers: authHeaders(token) });
  const json = await res.json();
  if (!res.ok) fail(`状態を取得できませんでした（${res.status}）: ${JSON.stringify(json)}`);

  console.log(`拡張機能 ID : ${json.id}`);
  console.log(`下書きの状態 : ${json.uploadState}`);
  console.log(`公開の状態   : ${json.publicKey ? '登録済み' : '不明'}`);
  if (json.itemError?.length) {
    console.log('指摘:');
    for (const e of json.itemError) console.log(`  - ${e.error_detail}`);
  }
  return json;
}

async function upload() {
  if (!fs.existsSync(ZIP)) fail('dist.zip がありません。先に `npm run pack` を実行してください。');

  const size = fs.statSync(ZIP).size;
  console.log(`アップロードするファイル: dist.zip (${(size / 1024).toFixed(1)} KB)`);

  const token = await getAccessToken();
  const id = requireEnv('CWS_EXTENSION_ID');

  const res = await fetch(`${UPLOAD_API}/items/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: fs.readFileSync(ZIP),
  });
  const json = await res.json();

  if (json.uploadState !== 'SUCCESS') {
    const details = (json.itemError || []).map((e) => `  - ${e.error_detail}`).join('\n');
    fail(`アップロードに失敗しました（${json.uploadState}）\n${details}`);
  }

  console.log('アップロード成功。ストアの下書きが更新されました（まだ公開されていません）。');
  console.log(`確認: https://chrome.google.com/webstore/devconsole/`);
}

async function publish() {
  const target = has('--testers') ? 'trustedTesters' : 'default';
  const label = target === 'default' ? 'すべてのユーザー' : '限定テスター';

  if (!has('--yes')) {
    fail(
      `公開は取り消せない操作です。実行するには --yes を付けてください。\n` +
      `  公開先: ${label}\n` +
      `  コマンド: node scripts/cws.mjs publish${has('--testers') ? ' --testers' : ''} --yes`
    );
  }

  const token = await getAccessToken();
  const id = requireEnv('CWS_EXTENSION_ID');

  console.log(`公開します（公開先: ${label}）...`);
  const res = await fetch(`${API}/items/${id}/publish?publishTarget=${target}`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Length': '0' },
  });
  const json = await res.json();

  if (!res.ok) fail(`公開に失敗しました（${res.status}）: ${JSON.stringify(json)}`);

  console.log(`受理されました: ${(json.status || []).join(', ')}`);
  for (const d of json.statusDetail || []) console.log(`  ${d}`);
  console.log('\nこの後 Google の審査が入ります（通常 1〜3 営業日）。結果はメールで届きます。');
}

const commands = { status, upload, publish };
if (!commands[command]) {
  console.log(`使い方:
  node scripts/cws.mjs status                  状態を見る
  node scripts/cws.mjs upload                  dist.zip を下書きとしてアップロード
  node scripts/cws.mjs publish --yes           公開する（取り消せない）
  node scripts/cws.mjs publish --testers --yes 限定テスターにだけ公開する`);
  process.exit(command ? 1 : 0);
}

await commands[command]();
