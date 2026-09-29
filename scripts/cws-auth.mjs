// Chrome ウェブストア API 用のリフレッシュトークンを取得する。
//
//   CWS_CLIENT_ID=... CWS_CLIENT_SECRET=... node scripts/cws-auth.mjs
//
// この処理はすべて手元で完結します。通信先は Google の認証サーバーだけで、
// 取得したトークンは画面に出すだけです（ファイルにも保存しません）。
// 表示されたトークンは GitHub の Secrets にだけ登録し、
// チャットや外部サービスに貼らないでください。

import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { exec, spawnSync } from 'child_process';

const PORT = 8123;
const REDIRECT = `http://localhost:${PORT}`;
const SCOPE = 'https://www.googleapis.com/auth/chromewebstore';

/**
 * 認証情報を読む。
 * Google Cloud Console から落とせる JSON をそのまま渡せるようにしてある。
 * シークレットを手で写したり、シェルの履歴に残したりしなくて済む。
 */
const SAVE_TO_GITHUB = process.argv.includes('--save');

/**
 * 取得したトークンを GitHub の Secrets に直接登録する。
 * 値は gh の標準入力に渡すので、画面にもシェルの履歴にも残らない。
 */
function saveSecret(name, value) {
  const gh = spawnSync('gh', ['secret', 'set', name], {
    input: value,
    encoding: 'utf8',
  });
  if (gh.error) {
    console.error(`  ${name}: gh コマンドが見つかりません（${gh.error.message}）`);
    return false;
  }
  if (gh.status !== 0) {
    console.error(`  ${name}: 登録に失敗しました\n${(gh.stderr || '').trim()}`);
    return false;
  }
  console.log(`  ${name}: 登録しました`);
  return true;
}

function loadCredentials() {
  const file = process.argv.find((a, i) => i >= 2 && !a.startsWith('--'));

  if (file) {
    const full = path.resolve(file);
    if (!fs.existsSync(full)) {
      console.error(`ファイルが見つかりません: ${full}`);
      process.exit(1);
    }
    let json;
    try {
      json = JSON.parse(fs.readFileSync(full, 'utf8'));
    } catch {
      console.error(`JSON として読めませんでした: ${full}`);
      process.exit(1);
    }
    // ダウンロードした JSON は web か installed のどちらかに入っている
    const c = json.web || json.installed || json;
    if (!c.client_id) {
      console.error(
        `この JSON には client_id が入っていません。\n` +
        `Google Cloud Console の「認証情報」で、OAuth 2.0 クライアント ID の行にある\n` +
        `ダウンロードボタンから落とした JSON を指定してください。`
      );
      process.exit(1);
    }

    // 「デスクトップ アプリ」種別は、いまはシークレットが発行されない（公開クライアント）。
    // その場合は PKCE で認可する。シークレットの管理がそもそも要らなくなる。
    const kind = json.installed ? 'デスクトップ アプリ' : 'ウェブ アプリケーション';
    console.log(`認証情報を読み込みました: ${path.basename(full)}（${kind}）`);
    if (!c.client_secret) {
      console.log('クライアント シークレットなし → PKCE で認可します（シークレットは不要です）');
    }

    const uris = c.redirect_uris || [];
    if (uris.length && !uris.includes(REDIRECT)) {
      console.warn(
        `\n注意: 承認済みリダイレクト URI に ${REDIRECT} が登録されていません。\n` +
        `      登録済み: ${uris.join(', ') || '（なし）'}\n` +
        `      このまま進めると redirect_uri_mismatch で失敗します。\n`
      );
    }
    return { id: c.client_id, secret: c.client_secret || null };
  }

  if (process.env.CWS_CLIENT_ID) {
    return { id: process.env.CWS_CLIENT_ID, secret: process.env.CWS_CLIENT_SECRET || null };
  }

  console.error(`認証情報がありません。次のどちらかで渡してください。

  1) Google Cloud Console から落とした JSON をそのまま渡す（おすすめ）
     npm run cws:auth -- ~/Downloads/client_secret_xxxxx.json

  2) 環境変数で渡す
     CWS_CLIENT_ID=xxx CWS_CLIENT_SECRET=yyy npm run cws:auth

種類は「デスクトップ アプリ」でも「ウェブ アプリケーション」でも構いません。
  デスクトップ アプリ  : シークレットは発行されません。PKCE で認可するので不要です
  ウェブ アプリケーション: 承認済みリダイレクト URI に ${REDIRECT} の登録が必要です

詳しい手順は docs/RELEASE.md にあります。`);
  process.exit(1);
}

const { id: CLIENT_ID, secret: CLIENT_SECRET } = loadCredentials();

// PKCE: 認可コードを盗まれても、対になる verifier がないと交換できないようにする
const verifier = crypto.randomBytes(48).toString('base64url');
const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

const authUrl =
  'https://accounts.google.com/o/oauth2/auth?' +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent', // 毎回 refresh_token を返させる
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

console.log('ブラウザで次の URL を開いて、許可してください:\n');
console.log(authUrl + '\n');
exec(`open "${authUrl}"`, () => {});

const code = await new Promise((resolve, reject) => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, REDIRECT);
    const c = url.searchParams.get('code');
    const err = url.searchParams.get('error');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(
      `<meta charset="utf-8"><body style="font-family:sans-serif;padding:40px">
       <h2>${c ? '受け取りました。ターミナルに戻ってください。' : 'エラー: ' + err}</h2></body>`
    );
    server.close();
    c ? resolve(c) : reject(new Error(err || 'コードを受け取れませんでした'));
  });
  server.listen(PORT);
  setTimeout(() => { server.close(); reject(new Error('5 分待っても応答がありませんでした')); }, 300000);
});

const params = {
  client_id: CLIENT_ID,
  code,
  grant_type: 'authorization_code',
  redirect_uri: REDIRECT,
  code_verifier: verifier,
};
if (CLIENT_SECRET) params.client_secret = CLIENT_SECRET;

const res = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(params),
});

const json = await res.json();
if (!json.refresh_token) {
  console.error('リフレッシュトークンを取得できませんでした:', json.error || json);
  console.error('（一度許可済みの場合は、Google アカウントの「サードパーティ アクセス」から解除してやり直してください）');
  process.exit(1);
}

if (SAVE_TO_GITHUB) {
  console.log('\nGitHub の Secrets に登録します...');
  const ok =
    saveSecret('CWS_CLIENT_ID', CLIENT_ID) & saveSecret('CWS_REFRESH_TOKEN', json.refresh_token);
  if (CLIENT_SECRET) saveSecret('CWS_CLIENT_SECRET', CLIENT_SECRET);

  if (ok) {
    console.log(`
残りは拡張機能 ID だけです。ストアに初回アップロードすると発行されます。

  gh secret set CWS_EXTENSION_ID

  （実行するとその場で入力を求められます。画面には表示されません）

登録済みの一覧: gh secret list`);
    process.exit(0);
  }
  console.error('\n登録に失敗したので、下の値を手で登録してください。');
}

console.log('\n=============================================');
console.log('CWS_REFRESH_TOKEN=' + json.refresh_token);
console.log('=============================================\n');
console.log(`GitHub に登録するには、次のどちらかで。

  コマンドで登録する（値は画面に出ません）
    gh secret set CWS_CLIENT_ID
    gh secret set CWS_REFRESH_TOKEN
    gh secret set CWS_EXTENSION_ID

  次回からは --save を付ければ、取得と同時に登録されます
    npm run cws:auth -- <JSONのパス> --save

画面から登録する場合は Settings → Secrets and variables → Actions。

  CWS_CLIENT_ID     ${CLIENT_ID}
  CWS_REFRESH_TOKEN 上の値
  CWS_EXTENSION_ID  ストアの拡張機能 ID（32文字）
${CLIENT_SECRET ? '  CWS_CLIENT_SECRET このクライアントのシークレット\n' : '  CWS_CLIENT_SECRET は不要です（シークレットのないクライアントのため）\n'}
  - リポジトリにコミットしない
  - チャットや外部サービスに貼らない
  - OAuth 同意画面が「テスト」状態のままだと 7 日で失効します。
    失効したらこのコマンドをもう一度実行してください。`);
