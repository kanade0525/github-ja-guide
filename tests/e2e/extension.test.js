import { test, expect, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const FIXTURE = `file://${path.resolve(ROOT, 'tests', 'fixtures', 'github-mock.html')}`;
const CONTENT_JS = path.resolve(ROOT, 'content.js');
const STYLES_CSS = path.resolve(ROOT, 'styles.css');

/** @type {import('@playwright/test').BrowserContext} */
let context;
/** @type {import('@playwright/test').Page} */
let page;

// manifest の matches は https://github.com/* に絞ってあるため、
// file:// のテストページには content script が自動注入されない。
// ビルド済みの content.js を直接注入して DOM の挙動だけを検証する。
// （content.js は chrome API が無い環境では既定値で動くようにしてある）
async function loadFixture() {
  page = await context.newPage();
  await page.goto(FIXTURE);
  await page.addStyleTag({ path: STYLES_CSS });
  await page.addScriptTag({ path: CONTENT_JS });
  await page.waitForFunction(() => document.querySelector('.ghja') !== null, null, { timeout: 5000 });
}

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    args: ['--no-first-run', '--disable-gpu'],
  });
});

test.afterAll(async () => {
  await context?.close();
});

test.beforeEach(async () => {
  await loadFixture();
});

test.afterEach(async () => {
  await page?.close();
});

// ============================================================
// 注釈が付くべき場所
// ============================================================

test('グローバルナビの Pull requests に日本語が添えられる', async () => {
  const label = page.locator('#nav-pulls .ghja-ja');
  await expect(label).toHaveText('変更の取り込み依頼');
});

test('英語ラベルは消えずに残っている', async () => {
  await expect(page.locator('#nav-pulls .ghja')).toContainText('Pull requests');
});

test('リポジトリのタブに日本語が添えられる', async () => {
  await expect(page.locator('#tab-code .ghja-ja')).toHaveText('ファイル一覧');
  await expect(page.locator('#tab-actions .ghja-ja')).toHaveText('自動処理');
  await expect(page.locator('#tab-settings .ghja-ja')).toHaveText('設定');
});

test('ボタンのラベルに日本語が添えられる', async () => {
  await expect(page.locator('#btn-fork .ghja-ja')).toHaveText('自分用にコピー');
  await expect(page.locator('#btn-star .ghja-ja')).toHaveText('お気に入り');
});

test('複数語のラベルにも一致する', async () => {
  await expect(page.locator('#btn-squash .ghja-ja')).toHaveText('まとめて取り込む');
  await expect(page.locator('#pr-tab-files .ghja-ja')).toHaveText('変更したファイル');
});

// ============================================================
// 注釈が付いてはいけない場所（誤爆防止）
// ============================================================

test('本文の文章中の Fork には付かない', async () => {
  await expect(page.locator('#body-sentence .ghja')).toHaveCount(0);
  await expect(page.locator('#body-sentence')).toHaveText('このプロジェクトを Fork して自由に使ってください。');
});

test('本文の中なら完全一致でも付かない', async () => {
  await expect(page.locator('#body-exact .ghja')).toHaveCount(0);
  await expect(page.locator('#body-exact2 .ghja')).toHaveCount(0);
});

test('コードブロックの中には付かない', async () => {
  await expect(page.locator('#code-merge .ghja')).toHaveCount(0);
  await expect(page.locator('#code-merge')).toHaveText('Merge');
});

test('入力欄の中には付かない', async () => {
  await expect(page.locator('#comment-box .ghja')).toHaveCount(0);
  await expect(page.locator('#comment-box')).toHaveValue('Fork');
  await expect(page.locator('#title-input')).toHaveValue('Issues');
});

test('検索・フィルタ欄の中には付かない', async () => {
  await expect(page.locator('#query-open .ghja')).toHaveCount(0);
  await expect(page.locator('#query-box')).toHaveText('is:pr state:Open');
});

test('リッチテキストの入力欄の中には付かない', async () => {
  await expect(page.locator('#rich-fork .ghja')).toHaveCount(0);
  await expect(page.locator('#rich-comment')).toHaveText('Fork');
});

test('部分一致する文字列には付かない', async () => {
  await expect(page.locator('#fork-note .ghja')).toHaveCount(0);
  await expect(page.locator('#fork-note')).toHaveText('Forked from octocat/hello');
});

// ============================================================
// 再処理・SPA・後片付け
// ============================================================

test('再走査しても二重に注釈が付かない', async () => {
  const before = await page.locator('.ghja').count();
  await page.evaluate(() => window.__ghja.annotate(document.body));
  await page.evaluate(() => window.__ghja.annotate(document.body));
  expect(await page.locator('.ghja').count()).toBe(before);
  expect(await page.locator('.ghja .ghja').count()).toBe(0);
});

test('後から差し込まれた要素にも注釈が付く（SPA 対応）', async () => {
  await page.evaluate(() => {
    const el = document.createElement('a');
    el.id = 'spa-added';
    el.innerHTML = '<span>Milestone</span>';
    document.getElementById('spa-target').appendChild(el);
  });
  await expect(page.locator('#spa-added .ghja-ja')).toHaveText('締め切りのまとまり');
});

test('無効化すると元の DOM に戻る', async () => {
  await page.evaluate(() => window.__ghja.removeAllAnnotations());
  await expect(page.locator('.ghja')).toHaveCount(0);
  await expect(page.locator('#nav-pulls')).toHaveText('Pull requests');
  await expect(page.locator('#btn-fork')).toHaveText('Fork');
});

// ============================================================
// ツールチップ
// ============================================================

test('ホバーすると説明のツールチップが出る', async () => {
  const tip = page.locator('.ghja-tip');
  await expect(tip).toHaveCount(0);

  await page.locator('#btn-fork .ghja').hover();
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('自分のアカウントに丸ごと複製');
});

test('ツールチップは 1 個を使い回す', async () => {
  await page.locator('#btn-fork .ghja').hover();
  await expect(page.locator('.ghja-tip')).toBeVisible();
  await page.locator('#tab-code .ghja').hover();
  await expect(page.locator('.ghja-tip')).toHaveCount(1);
  await expect(page.locator('.ghja-tip')).toContainText('ファイルとフォルダ');
});

test('ホバーを外すとツールチップが隠れる', async () => {
  await page.locator('#btn-fork .ghja').hover();
  await expect(page.locator('.ghja-tip')).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(page.locator('.ghja-tip')).toBeHidden();
});

test('ツールチップが画面外にはみ出さない', async () => {
  await page.locator('#tab-settings .ghja').hover();
  await expect(page.locator('.ghja-tip')).toBeVisible();
  const box = await page.locator('.ghja-tip').boundingBox();
  const width = await page.evaluate(() => window.innerWidth);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width);
});

// ============================================================
// Issue を新しく書く画面の案内パネル
// ============================================================

const NEW_ISSUE = `file://${path.resolve(ROOT, 'tests', 'fixtures', 'issues', 'new', 'index.html')}`;

test.describe('Issue の依頼支援', () => {
  test.beforeEach(async () => {
    await page.goto(NEW_ISSUE);
    await page.addStyleTag({ path: STYLES_CSS });
    await page.addScriptTag({ path: CONTENT_JS });
    await page.waitForSelector('#ghja-issue-helper', { timeout: 5000 });
  });

  test('案内パネルがフォームの前に差し込まれる', async () => {
    const panel = page.locator('#ghja-issue-helper');
    await expect(panel).toBeVisible();
    await expect(panel.locator('h2')).toHaveText('伝わる依頼の書き方');
    // フォームより前にあること
    const order = await page.evaluate(() => {
      const p = document.getElementById('ghja-issue-helper');
      const f = document.getElementById('issue-form');
      return p.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING ? 'before' : 'after';
    });
    expect(order).toBe('before');
  });

  test('書き方の要点が並んでいる', async () => {
    const items = page.locator('#ghja-issue-helper .ghja-panel__list li');
    await expect(items).toHaveCount(4);
    await expect(items.first()).toContainText('何が起きたか');
  });

  test('雛形のボタンが 3 種類ある', async () => {
    const buttons = page.locator('#ghja-issue-helper .ghja-panel__btn');
    await expect(buttons).toHaveCount(3);
    await expect(buttons.nth(0)).toHaveText('うまく動かない（バグ報告）');
  });

  test('雛形が本文に入る', async () => {
    await page.locator('#ghja-issue-helper .ghja-panel__btn').first().click();
    const body = await page.locator('textarea[name="issue[body]"]').inputValue();
    expect(body).toContain('## 何が起きたか');
    expect(body).toContain('## どうなってほしいか');
    expect(body).toContain('## 手順');
  });

  test('すでに書いた内容を消さない', async () => {
    await page.fill('textarea[name="issue[body]"]', '先に書いたメモ');
    await page.locator('#ghja-issue-helper .ghja-panel__btn').nth(1).click();
    const body = await page.locator('textarea[name="issue[body]"]').inputValue();
    expect(body).toContain('先に書いたメモ');
    expect(body).toContain('## 困っていること');
  });

  test('挿入後にボタンの表示が戻る', async () => {
    const button = page.locator('#ghja-issue-helper .ghja-panel__btn').first();
    await button.click();
    await expect(button).toHaveText('本文に入れました');
    await expect(button).toHaveText('うまく動かない（バグ報告）', { timeout: 4000 });
  });

  test('Issue 以外の画面にはパネルを出さない', async () => {
    await page.goto(FIXTURE);
    await page.addScriptTag({ path: CONTENT_JS });
    await page.waitForTimeout(800);
    await expect(page.locator('#ghja-issue-helper')).toHaveCount(0);
  });
});
