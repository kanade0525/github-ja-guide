// README に貼る画像を作る。
//   npm run build && node scripts/readme-images.mjs
//
// ストア用（store-images.mjs）は見出しを付けた宣伝用だが、
// README は前後に文章があるので、素の切り出しのほうが読みやすい。
// 出力先は docs/images/（こちらは git 管理する）。

import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'docs', 'images');
const REPO = 'https://github.com/kanade0525/github-ja-guide';

fs.mkdirSync(OUT, { recursive: true });

// 拡張機能が動いていないページ（ポップアップ・模擬ページ）用の chrome 差し替え
const CHROME_STUB = `
  const store = { enabled:true, showInline:true, showTooltip:true, fontScale:85, opacity:75, excludedPaths:[] };
  // chrome.storage は「コールバック」と「Promise」の両方の呼び方をされる。
  // content script はコールバック形式を使うので、両対応にしないと起動しない。
  const get = (d, cb) => {
    const result = { ...d, ...store };
    if (typeof cb === 'function') { cb(result); return; }
    return Promise.resolve(result);
  };
  const set = (v, cb) => {
    Object.assign(store, v);
    if (typeof cb === 'function') { cb(); return; }
    return Promise.resolve();
  };
  window.chrome = {
    storage: { sync: { get, set } },
    runtime: { openOptionsPage(){}, getURL: (p) => p },
    tabs: { create(){} },
  };
`;

function save(file, buffer) {
  fs.writeFileSync(path.join(OUT, file), buffer);
  const { width, height } = { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  console.log(`  docs/images/${file.padEnd(18)} ${width}x${height}`);
}

// ---- 実際の GitHub を撮る（拡張機能は headless では読み込まれない）----
const live = await chromium.launchPersistentContext('', {
  headless: false,
  args: [
    `--disable-extensions-except=${ROOT}`,
    `--load-extension=${ROOT}`,
    '--no-first-run',
    '--force-device-scale-factor=2', // 切り出して拡大しても粗くならないよう 2 倍で撮る
    '--hide-scrollbars',
  ],
  viewport: { width: 1440, height: 900 },
});
const page = await live.newPage();

/** 注釈の位置から切り出す範囲を決め、その部分だけを撮る */
async function shootRegion(file, labels, { pad = 18, grow = {}, maxWidth = 900 } = {}) {
  const region = await page.evaluate(
    ([wanted, p, g, mw]) => {
      const rects = [];
      for (const el of document.querySelectorAll('.ghja')) {
        const t = (el.firstChild?.textContent || '').trim();
        if (wanted.includes(t)) rects.push(el.getBoundingClientRect());
      }
      const tip = document.querySelector('.ghja-tip.is-visible');
      if (tip) rects.push(tip.getBoundingClientRect());
      const visible = rects.filter((r) => r.width && r.bottom > 0 && r.top < window.innerHeight);
      if (visible.length < 2) return null;

      const bar = document.querySelector('header[class*="MarketingHeader"], header.header-logged-out');
      const barBottom = bar ? bar.getBoundingClientRect().bottom : 0;
      const top = Math.max(0, Math.min(
        Math.min(...visible.map((r) => r.top)) - p,
        Math.max(barBottom + 4, Math.min(...visible.map((r) => r.top)) - p - (g.top || 0))
      ));
      const left = Math.max(0, Math.min(...visible.map((r) => r.left)) - p - (g.left || 0));
      return {
        x: left,
        y: top,
        width: Math.min(Math.max(...visible.map((r) => r.right)) + p - left, mw),
        height: Math.max(...visible.map((r) => r.bottom)) + p + (g.bottom || 0) - top,
      };
    },
    [labels, pad, grow, maxWidth]
  );
  if (!region) throw new Error(`${file}: 注釈が見つかりません`);

  // スクロールを起こさない CDP 撮影（ツールチップは scroll で閉じるため）
  const cdp = await page.context().newCDPSession(page);
  const { data } = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    clip: { ...region, scale: 1 },
  });
  await cdp.detach();
  save(file, Buffer.from(data, 'base64'));
}

async function open(url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
}

await open(REPO);
await shootRegion('labels.png', ['Code', 'Issues', 'Pull requests', 'Actions'], {
  grow: { top: 56, bottom: 26, left: 22 },
  maxWidth: 880,
});

await open(REPO);
{
  const tip = page.locator('.ghja-tip.is-visible');
  for (const word of ['Pull requests', 'Issues']) {
    const target = page.locator('.ghja--has-tip').filter({ hasText: word }).first();
    if (!(await target.count())) continue;
    await target.hover();
    await page.waitForTimeout(600);
    if (await tip.count()) break;
  }
  if (!(await tip.count())) throw new Error('ツールチップを表示できませんでした');
  await shootRegion('tooltip.png', ['Code', 'Issues', 'Pull requests', 'Actions'], {
    grow: { left: 22, bottom: 16 },
    maxWidth: 880,
  });
}

await live.close();

// ---- 拡張機能の画面と模擬ページ（実サイト不要）----
const browser = await chromium.launch();

// ポップアップ
{
  const p = await browser.newPage({ viewport: { width: 300, height: 320 }, deviceScaleFactor: 2 });
  await p.addInitScript(CHROME_STUB);
  await p.goto(`file://${path.join(ROOT, 'popup.html')}`);
  await p.waitForTimeout(400);
  save('popup.png', await p.screenshot());
  await p.close();
}

// Issue を書く画面の案内（実際の /issues/new はログインが要るので模擬ページで撮る）
{
  const p = await browser.newPage({ viewport: { width: 880, height: 420 }, deviceScaleFactor: 2 });
  await p.addInitScript(CHROME_STUB);
  await p.goto(`file://${path.join(ROOT, 'tests/fixtures/issues/new/index.html')}`);
  await p.addStyleTag({ path: path.join(ROOT, 'styles.css') });
  await p.addScriptTag({ path: path.join(ROOT, 'content.js') });
  await p.waitForSelector('#ghja-issue-helper');
  await p.waitForTimeout(300);
  save('issue-helper.png', await p.locator('#ghja-issue-helper').screenshot());
  await p.close();
}

// 考え方ガイド
{
  const p = await browser.newPage({ viewport: { width: 880, height: 620 }, deviceScaleFactor: 2 });
  await p.goto(`file://${path.join(ROOT, 'guide.html')}`);
  await p.waitForTimeout(400);
  save('guide.png', await p.screenshot());
  await p.close();
}

await browser.close();
console.log('\ndocs/images/ を更新しました。');
