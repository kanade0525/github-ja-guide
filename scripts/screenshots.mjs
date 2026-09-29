// Chrome ウェブストア提出用のスクリーンショット（1280x800）を作る。
//   npm run build && node scripts/screenshots.mjs
//
// 実際の github.com を開いて撮る。拡張機能は headless では読み込まれないため
// ウィンドウが開くが、操作は不要。

import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'store-assets');
const SIZE = { width: 1280, height: 800 };

fs.mkdirSync(OUT, { recursive: true });

const ctx = await chromium.launchPersistentContext('', {
  headless: false, // Chrome 拡張は headless では読み込まれない
  args: [
    `--disable-extensions-except=${ROOT}`,
    `--load-extension=${ROOT}`,
    '--no-first-run',
    // Retina のままだと CDP 撮影が 2 倍の解像度になる。ストアは 1280x800 しか受け付けない
    '--force-device-scale-factor=1',
  ],
  viewport: SIZE,
  // Retina だと CDP 撮影が 2 倍の解像度になってしまうので 1 に固定する
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();

async function shoot(name, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4500);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  const n = await page.evaluate(() => document.querySelectorAll('.ghja').length);
  console.log(`${name.padEnd(22)} 注釈 ${String(n).padStart(3)} 箇所  → store-assets/${name}.png`);
  return n;
}

// ツールチップはスクロールすると閉じる仕様。
// Playwright の page.screenshot() は内部でスクロールを起こすため、
// 普通に撮ると必ず消えてしまう。CDP で直接撮るとスクロールが起きない。
async function shootTooltip(name, url, words) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4500);

  const tip = page.locator('.ghja-tip.is-visible');
  const file = path.join(OUT, `${name}.png`);

  for (let attempt = 1; attempt <= 6; attempt++) {
    const word = words[attempt % words.length];
    const target = page.locator('.ghja--has-tip').filter({ hasText: word }).first();
    if (!(await target.count())) continue;

    await target.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    await target.hover();
    await page.waitForTimeout(500);
    if (!(await tip.count())) continue;

    const cdp = await page.context().newCDPSession(page);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    await cdp.detach();

    // 撮影後もまだ出ていれば、写真にも写っているとみなせる
    if (await tip.count()) {
      const text = (await tip.textContent()).slice(0, 26);
      const n = await page.evaluate(() => document.querySelectorAll('.ghja').length);
      console.log(`${name.padEnd(22)} 注釈 ${String(n).padStart(3)} 箇所  → store-assets/${name}.png`);
      console.log(`  ツールチップ（${word}）: ${text}...`);
      return n;
    }
    console.log(`  ${attempt} 回目: 撮影中にツールチップが消えたのでやり直します`);
  }
  throw new Error('ツールチップを写せませんでした');
}

// 1. リポジトリのトップ
await shoot('01-repository', 'https://github.com/nobuo-miura/github-ui-translator');

// 2. ツールチップを出した状態
await shootTooltip('02-tooltip', 'https://github.com/nobuo-miura/github-ui-translator',
  ['Pull requests', 'Fork', 'Issues']);

// 3. Pull request の一覧
await shoot('03-pull-requests', 'https://github.com/microsoft/vscode/pulls');

// 4. Actions（自動処理）
const actionsCount = await shoot('04-actions', 'https://github.com/nobuo-miura/github-ui-translator/actions');

// 5. ダークモード
await page.emulateMedia({ colorScheme: 'dark' });
await shoot('05-dark', 'https://github.com/microsoft/vscode');
await page.emulateMedia({ colorScheme: 'light' });

// 誤爆の最終確認
const leaks = await page.evaluate(() => {
  const sel = '.markdown-body .ghja, pre .ghja, code .ghja, [role="search"] .ghja, [role="combobox"] .ghja, [role="textbox"] .ghja';
  return [...new Set([...document.querySelectorAll(sel)].map((e) => e.textContent.trim()))];
});
console.log(`\n誤爆チェック: ${leaks.length ? '要確認 ' + leaks.join(', ') : 'なし'}`);
console.log(`Actions 画面の注釈: ${actionsCount} 箇所`);

await ctx.close();

// ストアは 1280x800 か 640x400 しか受け付けない。取り違えないよう検査する。
function pngSize(file) {
  const buf = fs.readFileSync(file);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

let bad = 0;
console.log('\n--- 画像サイズの確認 ---');
for (const file of fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).sort()) {
  const { width, height } = pngSize(path.join(OUT, file));
  const ok = width === SIZE.width && height === SIZE.height;
  if (!ok) bad++;
  console.log(`  ${ok ? 'OK ' : 'NG '} ${file.padEnd(22)} ${width}x${height}`);
}
if (bad) {
  console.error(`\n${bad} 件が ${SIZE.width}x${SIZE.height} になっていません。`);
  process.exit(1);
}
console.log(`\nすべて ${SIZE.width}x${SIZE.height}。store-assets/ をそのまま提出できます。`);
