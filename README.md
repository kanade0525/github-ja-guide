# GitHub やさしく日本語

GitHub の画面に出る英語のラベルはそのまま残して、**横に小さく日本語の意味**を添える Chrome 拡張機能です。

```
[ Pull requests 変更の取り込み依頼 ]   [ Issues 課題・要望 ]   [ Fork 自分用にコピー ]
```

マウスを乗せると、その用語が何なのかの説明が出ます。

> Fork — 他の人のプロジェクトを自分のアカウントに丸ごと複製します。元には影響しません。

## なぜ英語を消さないのか

英語を全部日本語に置き換えてしまうと、先輩に画面を見せて質問するときや、英語の手順書・技術記事と照らし合わせるときに困ります。英語を残したまま意味を添えるので、使っているうちに用語そのものを覚えられます。

## 特徴

- **208 語の GitHub 用語**に対応（ナビ、リポジトリ、Issue、Pull request、Actions、安全性、アカウント）
- **外部送信なし。** 同梱の辞書でブラウザ内だけで完結します。翻訳 API もクラウドも使いません
- **要求する権限は `storage` だけ。** 動くのは `github.com` 上のみです
- **本文やコードには手を出しません。** 注釈が付くのはナビやボタンなどの UI ラベルだけ。Issue の本文中に出てくる "fork" や、コードブロックの中の `merge` はそのままです
- **画面が切り替わっても追従します。** GitHub はページを再読み込みせず中身を差し替えるため、その変化を監視して付け直します

## インストール（開発版）

```bash
git clone <このリポジトリ>
cd github-ja-guide
npm ci
npm run build
```

1. Chrome で `chrome://extensions` を開く
2. 右上の「デベロッパーモード」をオンにする
3. 「パッケージ化されていない拡張機能を読み込む」で、このフォルダを選ぶ
4. GitHub のページを開き直す

## 設定

ツールバーのアイコンから切り替えられます。

| 場所 | できること |
|---|---|
| ポップアップ | 表示のオン／オフ、表示のしかた（横に日本語／説明だけ） |
| 設定ページ | 日本語部分の大きさ・濃さ、表示しないページの指定 |

## 用語を追加・修正したいとき

辞書は `src/glossary.js` の 1 ファイルにまとまっています。

```js
'Squash and merge': {
  ja: 'まとめて取り込む',
  desc: '細かい変更記録を 1 つにまとめてから本体に合流させます。履歴がすっきりします。',
},
```

- `ja` は横に添える短い言い換え。12 文字以内（テストで縛っています）
- `desc` はホバーで出る説明。専門用語を使わず 1〜2 文で
- 単数形・複数形は両方を別のキーとして登録してください

追加したら `npm test` を回すと、長さや重複を検査します。

## ファイル構成

```
manifest.json               拡張機能の定義（権限は storage のみ）
content.js                  ビルド成果物（src/content.js から生成・git 管理外）
styles.css                  ページに注入するスタイル
popup.*                     ツールバーのポップアップ
options.*                   設定ページ

src/glossary.js             用語辞書（ここを育てるのが主な作業）
src/match.js                完全一致の照合と、注釈を付けない領域の判定
src/dom.js                  DOM の走査・書き換え・ツールチップ
src/settings.js             設定の読み書き
src/content.js              エントリポイント

scripts/generate-icons.js   アイコン PNG の生成
scripts/screenshots.mjs     ストア提出用スクリーンショットの生成
scripts/set-version.mjs     package.json と manifest.json のバージョンを揃える
scripts/cws.mjs             Chrome ウェブストア API（状態確認・アップロード・公開）
scripts/cws-auth.mjs        リフレッシュトークンの取得（手元で完結）

tests/                      ユニットテストと E2E
docs/QA.md                  実サイトでの手動確認の記録
docs/GLOSSARY.md            辞書の育て方
docs/RELEASE.md             リリースとストア公開の手順
```

## 開発

```bash
npm run build          # src/ → content.js
npm run watch          # 変更を監視してビルド
npm run lint           # ESLint
npm test               # ユニットテスト（Vitest）
npm run test:e2e       # E2E（Playwright・ローカルの模擬ページに対して）
npm run icons          # アイコン PNG を作り直す
npm run screenshots    # ストア用スクリーンショット（実 github.com を開く）
npm run pack           # ストア提出用の dist.zip を作る
```

E2E は実際の github.com にはアクセスせず、`tests/fixtures/github-mock.html` という GitHub の DOM を模したページに対して実行します。実サイトでの確認は `npm run screenshots` と手動で行い、`docs/QA.md` に記録します。

## リリースとストア公開

タグを push すると、検証 → GitHub リリース作成 → **ストアへの下書きアップロード**まで自動で進みます。

```bash
npm run version 0.2.0        # package.json と manifest.json を揃えて更新
git commit -am "v0.2.0"
git tag v0.2.0
git push --follow-tags
```

**公開（全ユーザーへの配布）は自動化していません。** 取り消せない操作なので、GitHub Actions からの手動実行と、確認欄への `PUBLISH` 入力を必須にしています。

初回の準備（開発者登録、API の有効化、リフレッシュトークンの取得）は `docs/RELEASE.md` を参照してください。

## ライセンス

MIT
