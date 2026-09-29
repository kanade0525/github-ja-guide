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
   - 承認済みのリダイレクト URI に `http://127.0.0.1:8123` を追加
5. 一覧に出たクライアントの行の **ダウンロードボタン（↓）** で JSON を落とす

> **「デスクトップ アプリ」種別は使えません**
>
> Google はループバック方式（`http://127.0.0.1` に戻す方式）を遮断しました。
> デスクトップ アプリ種別で作ると、許可画面で次のように拒否されます。
>
> > Access blocked: ... sent an invalid request（エラー 400: invalid_request）
> > The loopback flow has been blocked in order to keep users secure.
>
> `npm run cws:auth` は、ブラウザを開く前にこれを検出して止まります。
> その場合は「ウェブ アプリケーション」種別で作り直してください。
> こちらは明示的に登録したリダイレクト URI が使え、シークレットも発行されます。

> **クライアント シークレットの取り出し方**
>
> 作成直後のダイアログを閉じても、後から取り出せます。
> 「認証情報」の一覧でクライアント名をクリックすると画面右側に表示されます。
> ダウンロードした JSON にも入っています。

### 3. リフレッシュトークンを取る

手元で完結するヘルパーを用意してあります。
落とした JSON をそのまま渡せるので、シークレットを手で写す必要はありません。

```bash
npm run cws:auth -- ~/Downloads/client_secret_xxxxx.json
```

環境変数で渡すこともできます。

```bash
CWS_CLIENT_ID=<クライアントID> \
CWS_CLIENT_SECRET=<クライアントシークレット> \
npm run cws:auth
```

> 落とした JSON はリポジトリに置かないでください（`.gitignore` で `client_secret*.json` を
> 除外していますが、別の場所に置くほうが安全です）。用が済んだら削除して構いません。

ブラウザが開くので許可すると、ターミナルに `CWS_REFRESH_TOKEN=...` が表示されます。

> OAuth 同意画面が「テスト」状態のままだと、リフレッシュトークンは **7 日で失効**します。
> 失効したらこのコマンドをもう一度実行してください。継続的に使うなら同意画面を「本番」に切り替えます。

### 4. GitHub に登録する

**コマンドで登録するのが簡単で安全です。** 値は画面にもシェルの履歴にも残りません。

```bash
# 取得と同時に登録する（CWS_CLIENT_ID と CWS_REFRESH_TOKEN が入ります）
npm run cws:auth -- ~/Downloads/client_secret_xxxxx.json --save

# 拡張機能 ID はストアに初回アップロードしてから
gh secret set CWS_EXTENSION_ID

# 確認
gh secret list
```

`gh secret set` は引数を付けずに実行すると、その場で入力を求められます。
入力した文字は画面に表示されません。

<details>
<summary>画面から登録する場合</summary>

リポジトリの Settings → Secrets and variables → Actions で、次を登録します。
</details>


| 名前 | 中身 | 必須 |
|---|---|---|
| `CWS_CLIENT_ID` | OAuth クライアント ID | 必須 |
| `CWS_REFRESH_TOKEN` | 上で取得したトークン | 必須 |
| `CWS_EXTENSION_ID` | ストアの拡張機能 ID（32文字） | 必須 |
| `CWS_CLIENT_SECRET` | OAuth クライアント シークレット | **ウェブ アプリケーション種別のときだけ**。デスクトップ アプリ種別では不要 |

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
