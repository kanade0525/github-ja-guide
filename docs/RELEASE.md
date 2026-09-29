# リリース手順

タグを打つと、検証 → GitHub リリース作成 → **ストアへの下書きアップロード**までが自動で進みます。
**公開（全ユーザーへの配布）は自動化していません。** 取り消せない操作なので、手動実行と確認文字の入力を必須にしています。

---

## 取り扱いの注意

- 認証情報（Client Secret / リフレッシュトークン）は **GitHub の Secrets にだけ**登録してください
- リポジトリにコミットしない。チャットや外部サービスに貼らない
- 公開は取り消せません。まず限定テスターへの公開で確認することを勧めます

---

## 初回だけ必要な準備

### 1. 開発者登録と初回アップロード（手作業）

1. [Chrome ウェブストア デベロッパー ダッシュボード](https://chrome.google.com/webstore/devconsole/)にアクセス
2. 開発者登録料 $5 を支払う（初回のみ）
3. `npm run pack` で作った `dist.zip` を**手で 1 回アップロードする**
4. ストア掲載情報（説明・スクリーンショット・プライバシー）を埋める（→ `SUBMISSION_GUIDE.md`）
5. URL に出る 32 文字の ID を控える。これが `CWS_EXTENSION_ID`

> 初回だけ手作業が必要です。API は既存の項目を更新することしかできません。

### 2. API を使えるようにする

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作る
2. 「API とサービス」→「ライブラリ」で **Chrome Web Store API** を有効にする
3. 「OAuth 同意画面」を設定する
   - ユーザーの種類: 外部
   - テストユーザーに自分の Google アカウントを追加
4. 「認証情報」→「OAuth クライアント ID を作成」
   - 種類: **ウェブ アプリケーション**
   - 承認済みのリダイレクト URI: `http://localhost:8123`
   - できた **クライアント ID** と **クライアント シークレット** を控える

### 3. リフレッシュトークンを取る

手元で完結するヘルパーを用意してあります。

```bash
CWS_CLIENT_ID=<クライアントID> \
CWS_CLIENT_SECRET=<クライアントシークレット> \
npm run cws:auth
```

ブラウザが開くので許可すると、ターミナルに `CWS_REFRESH_TOKEN=...` が表示されます。

> OAuth 同意画面が「テスト」状態のままだと、リフレッシュトークンは **7 日で失効**します。
> 失効したらこのコマンドをもう一度実行してください。継続的に使うなら同意画面を「本番」に切り替えます。

### 4. GitHub に登録する

リポジトリの Settings → Secrets and variables → Actions で、次の 4 つを登録します。

| 名前 | 中身 |
|---|---|
| `CWS_CLIENT_ID` | OAuth クライアント ID |
| `CWS_CLIENT_SECRET` | OAuth クライアント シークレット |
| `CWS_REFRESH_TOKEN` | 上で取得したトークン |
| `CWS_EXTENSION_ID` | ストアの拡張機能 ID（32文字） |

あわせて Settings → Environments で次の 2 つを作っておくと、実行前に承認を挟めます。

- `chrome-web-store`（下書きアップロード用）
- `chrome-web-store-publish`（公開用。**Required reviewers を設定することを推奨**）

---

## ふだんのリリース

```bash
# 1. バージョンを上げる（package.json と manifest.json を揃えて書き換える）
npm run version 0.2.0

# 2. CHANGELOG.md に変更点を書く

# 3. コミットしてタグを push
git commit -am "v0.2.0"
git tag v0.2.0
git push --follow-tags
```

タグを push すると `Release` ワークフローが動き、ここまで自動で進みます。

1. Lint / ユニットテスト / E2E を実行
2. `package.json` と `manifest.json` と タグ名 のバージョン一致を確認
3. `dist.zip` を作る
4. GitHub リリースを作り、`dist.zip` を添付
5. **ストアに下書きとしてアップロード**（公開はされません）

### 公開する

ストアのダッシュボードで下書きの中身を確認してから、GitHub の Actions で `Release` ワークフローを**手動実行**します。

| 操作 | 選ぶもの | 確認欄 |
|---|---|---|
| 限定テスターに公開 | `publish-testers` | 不要 |
| 全ユーザーに公開 | `publish` | `PUBLISH` と入力 |

確認欄が一致しないとジョブは動きません。

---

## 手元から直接操作する

CI を通さずに試したいときは、環境変数を渡して直接叩けます。

```bash
npm run pack

export CWS_CLIENT_ID=... CWS_CLIENT_SECRET=... CWS_REFRESH_TOKEN=... CWS_EXTENSION_ID=...

npm run cws:status            # 下書きの状態を見る
npm run cws:upload            # 下書きとしてアップロード
node scripts/cws.mjs publish --testers --yes   # 限定テスターに公開
node scripts/cws.mjs publish --yes             # 全ユーザーに公開（取り消せない）
```

`--yes` を付けない限り公開は実行されません。

---

## 審査について

- 通常 1〜3 営業日
- 結果はメールで届く
- 差し戻されたら、指摘に対応して `npm run version` でバージョンを上げ、もう一度タグを打つ
- よくある差し戻し理由と対策は `SUBMISSION_GUIDE.md` にまとめてあります
