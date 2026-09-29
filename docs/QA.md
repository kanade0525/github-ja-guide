# 実サイトでの手動確認

E2E は `tests/fixtures/github-mock.html`（GitHub の DOM を模したページ）に対して動かしており、実際の github.com にはアクセスしません。
GitHub 側の画面構成は変わるため、リリース前に以下を目視で確認し、この表を更新します。

## 確認手順

```bash
npm run build
# chrome://extensions → デベロッパーモード → 「パッケージ化されていない拡張機能を読み込む」
```

## 確認する画面

| 画面 | 見るところ | 結果 | 確認日 |
|---|---|---|---|
| リポジトリのトップ | タブの Code / Issues / Pull requests / Actions に日本語が付く | OK（35箇所） | 2026-09-29 |
| リポジトリのトップ | Fork / Star / Watch / Sponsor のボタンに日本語が付く | OK | 2026-09-29 |
| リポジトリのトップ | 緑の Code ボタンの中でも日本語が読める | OK（色を周囲から継承するよう修正済み） | 2026-09-29 |
| README の表示部分 | 本文中の英単語に注釈が **付かない** | OK | 2026-09-29 |
| ファイル一覧 | Branches / Tags / Commits に日本語が付く | OK | 2026-09-29 |
| Issues 一覧 | ナビとタブに日本語が付く | OK（34箇所） | 2026-09-29 |
| Pull request 一覧 | New pull request / タブに日本語が付く | OK（40箇所） | 2026-09-29 |
| Pull request の Files changed | 差分のコード部分に注釈が **付かない** | OK（28箇所・コード内の誤爆なし） | 2026-09-29 |
| 検索・フィルタ欄 | `is:pr state:open` の open に注釈が **付かない** | OK（誤爆を発見し修正済み） | 2026-09-29 |
| タブ切り替え | ページ遷移後も注釈が付き直る（SPA 対応） | OK | 2026-09-29 |
| ダークモード | 日本語部分が読める濃さになっている | OK | 2026-09-29 |
| ツールチップ | ホバーで説明が出る | OK | 2026-09-29 |
| ポップアップ | オン／オフと表示のしかたの切り替え | OK | 2026-09-29 |
| 設定ページ | 大きさ・濃さのプレビュー、除外パスの追加と削除 | OK | 2026-09-29 |
| 設定ページ | 除外パスに HTML を入れても文字として表示される | OK（`<img src=x onerror=...>` がそのまま表示） | 2026-09-29 |
| Actions | Workflow / Branch / Status などに日本語が付く | OK（49〜55箇所） | 2026-09-29 |
| Settings | Collaborators / Visibility / Danger Zone に日本語が付く | 未確認（自分が所有するリポジトリが必要） | - |
| Issue 詳細 | Assignees / Labels に付き、コメント本文には付かない | 未確認（ログインが必要な要素あり） | - |
| リポジトリ巡回 | 15 ページを機械的に巡回し、未登録ラベルを収集 | 実施（`docs/GLOSSARY.md` 参照） | 2026-09-29 |

## 確認に使ったページ

- https://github.com/nobuo-miura/github-ui-translator
- https://github.com/microsoft/vscode/issues
- https://github.com/microsoft/vscode/pulls
- https://github.com/nobuo-miura/github-ui-translator/pull/87/files

## 見つかった問題と対応

| 内容 | 対応 |
|---|---|
| 緑の Code ボタンの上で日本語が読めなかった（固定のグレーを指定していたため） | `styles.css` の `.ghja-ja` を `color: inherit` に変更。濃さは `opacity` で落とす |
| 検索欄の `is:pr state:open` の `open` に「未解決」が付いた。GitHub の検索欄は `<input>` ではなく `role="combobox"` のウィジェットで、トークンが素の span になっている | `src/match.js` の `EXCLUDE_SELECTOR` に `[role="search"]` `[role="combobox"]` `[role="searchbox"]` `[role="textbox"]` `.QueryBuilder` を追加。E2E に回帰テストを追加 |

## メモ

- Chrome 拡張は **headless では読み込まれない**。実サイト確認をスクリプトで回す場合は `headless: false` にすること
- Playwright の `page.screenshot()` は内部でスクロールを起こす。ツールチップは scroll で閉じる仕様のため、
  ツールチップを写したいときは CDP の `Page.captureScreenshot` を使う（`scripts/screenshots.mjs` 参照）
- Retina のままだと CDP 撮影が 2 倍の解像度になる。`--force-device-scale-factor=1` が必要
- 誤爆した語を見つけたら、`src/match.js` の `EXCLUDE_SELECTOR` に領域を足すか、辞書の語を見直して対応する
