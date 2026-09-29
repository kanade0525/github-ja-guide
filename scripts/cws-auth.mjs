// Chrome ウェブストア API 用のリフレッシュトークンを取得する。
//
//   CWS_CLIENT_ID=... CWS_CLIENT_SECRET=... node scripts/cws-auth.mjs
//
// この処理はすべて手元で完結します。通信先は Google の認証サーバーだけで、
// 取得したトークンは画面に出すだけです（ファイルにも保存しません）。
// 表示されたトークンは GitHub の Secrets にだけ登録し、
// チャットや外部サービスに貼らないでください。

import http from 'http';
import { exec } from 'child_process';

const CLIENT_ID = process.env.CWS_CLIENT_ID;
const CLIENT_SECRET = process.env.CWS_CLIENT_SECRET;
const PORT = 8123;
const REDIRECT = `http://localhost:${PORT}`;
const SCOPE = 'https://www.googleapis.com/auth/chromewebstore';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(`環境変数が足りません。

  CWS_CLIENT_ID=xxx CWS_CLIENT_SECRET=yyy node scripts/cws-auth.mjs

Google Cloud Console で「OAuth クライアント ID」を
種類「ウェブ アプリケーション」で作り、
承認済みリダイレクト URI に ${REDIRECT} を登録してください。
詳しい手順は docs/RELEASE.md にあります。`);
  process.exit(1);
}

const authUrl =
  'https://accounts.google.com/o/oauth2/auth?' +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent', // 毎回 refresh_token を返させる
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

const res = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT,
  }),
});

const json = await res.json();
if (!json.refresh_token) {
  console.error('リフレッシュトークンを取得できませんでした:', json.error || json);
  console.error('（一度許可済みの場合は、Google アカウントの「サードパーティ アクセス」から解除してやり直してください）');
  process.exit(1);
}

console.log('\n=============================================');
console.log('CWS_REFRESH_TOKEN=' + json.refresh_token);
console.log('=============================================\n');
console.log(`この値は GitHub の Settings → Secrets and variables → Actions に
CWS_REFRESH_TOKEN という名前で登録してください。

  - リポジトリにコミットしない
  - チャットや外部サービスに貼らない
  - OAuth 同意画面が「テスト」状態のままだと 7 日で失効します。
    失効したらこのコマンドをもう一度実行してください。`);
