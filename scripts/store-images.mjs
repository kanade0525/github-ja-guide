// Chrome ウェブストア掲載用の画像（1280x800）を作る。
//
//   npm run build && node scripts/store-images.mjs
//
// 生の画面をそのまま出しても「ただの GitHub のスクショ」にしか見えないので、
//   1. 実画面を高解像度で撮る
//   2. 伝えたい部分だけを切り出して拡大する
//   3. 見出しを付けて 1280x800 に組む
// という手順で作る。題材は自分たちのリポジトリを使う（競合の画面を使わない）。

import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'store-assets');
const TMP = path.join(OUT, '.raw');
const CANVAS = { width: 1280, height: 800 };
const SHOT = { width: 1440, height: 900 }; // 撮影時のビューポート
const REPO = 'https://github.com/kanade0525/github-ja-guide';

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

const ctx = await chromium.launchPersistentContext('', {
  headless: false, // Chrome 拡張は headless では読み込まれない
  args: [
    `--disable-extensions-except=${ROOT}`,
    `--load-extension=${ROOT}`,
    '--no-first-run',
    '--force-device-scale-factor=2', // 拡大しても粗くならないよう 2 倍で撮る
    '--hide-scrollbars',
  ],
  viewport: SHOT,
});
const page = await ctx.newPage();

/** CDP で撮る。page.screenshot() はスクロールを起こしツールチップを閉じてしまうため。 */
async function capture(name) {
  const cdp = await page.context().newCDPSession(page);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  await cdp.detach();
  const file = path.join(TMP, `${name}.png`);
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  return file;
}

async function open(url, { dark = false } = {}) {
  await page.emulateMedia({ colorScheme: dark ? 'dark' : 'light' });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  // 前のカットのスクロール位置が残ると、切り出しが行の途中で切れる
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
}

/**
 * 注釈（.ghja）の位置から切り出す範囲を決める。
 * GitHub の class 名は変わりやすいので、自分が挿入した要素を基準にするほうが壊れにくい。
 *
 * 宣伝バーの高さは画面の状態で変わるため、固定値ではなく実測して避ける。
 * 最後に「狙った注釈が範囲に収まっているか」を検証し、外れていたら止める。
 * （収まっていない画像を気付かずに提出しないため）
 */
async function regionOfLabels(labels, opts = {}) {
  const { pad = 18, grow = {}, maxWidth = 780, maxHeight = 420, extra = [] } = opts;

  const measured = await page.evaluate(
    ([wanted, extraSel]) => {
      const hits = [];
      for (const el of document.querySelectorAll('.ghja')) {
        const text = (el.firstChild?.textContent || '').trim();
        if (!wanted.includes(text)) continue;
        const r = el.getBoundingClientRect();
        if (r.width && r.bottom > 0 && r.top < window.innerHeight) {
          hits.push({ text, left: r.left, top: r.top, right: r.right, bottom: r.bottom });
        }
      }
      const extras = [];
      for (const sel of extraSel) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        extras.push({ text: sel, left: r.left, top: r.top, right: r.right, bottom: r.bottom });
      }
      // 未ログイン時の黒い宣伝バー。高さは状況で変わるので実測する
      const bar = document.querySelector('header[class*="MarketingHeader"], header.header-logged-out');
      return { hits, extras, barBottom: bar ? bar.getBoundingClientRect().bottom : 0 };
    },
    [labels, extra]
  );

  const { hits, extras, barBottom } = measured;
  if (hits.length < 2) {
    throw new Error(`注釈が見つかりません（探したもの: ${labels.join(', ')} / 見つかった数: ${hits.length}）`);
  }

  const all = [...hits, ...extras];
  const wantLeft = Math.min(...all.map((r) => r.left));
  const wantTop = Math.min(...all.map((r) => r.top));
  const wantRight = Math.max(...all.map((r) => r.right));
  const wantBottom = Math.max(...all.map((r) => r.bottom));

  const left = Math.max(0, wantLeft - pad - (grow.left || 0));
  // 宣伝バーは避けるが、注釈より下には決して切り込まない
  const top = Math.max(0, Math.min(wantTop - pad, Math.max(barBottom + 4, wantTop - pad - (grow.top || 0))));
  const width = Math.min(wantRight - left + pad + (grow.right || 0), maxWidth);
  const height = Math.min(wantBottom - top + pad + (grow.bottom || 0), maxHeight);

  // 狙った注釈がちゃんと範囲に入っているかを確かめる
  const inside = hits.filter(
    (r) => r.left >= left - 1 && r.right <= left + width + 1 && r.top >= top - 1 && r.bottom <= top + height + 1
  );
  if (inside.length < 2) {
    throw new Error(
      `切り出し範囲に注釈が収まりません。範囲 x${Math.round(left)} y${Math.round(top)} ` +
      `${Math.round(width)}x${Math.round(height)} / 収まった注釈 ${inside.length} 件（${hits.map((h) => h.text).join(', ')}）`
    );
  }

  console.log(
    `    切り出し: x${Math.round(left)} y${Math.round(top)} ${Math.round(width)}x${Math.round(height)}` +
    `  バー下端=${Math.round(barBottom)}  収まった注釈=${inside.map((h) => h.text).join('/')}`
  );
  return { left, top, width, height };
}

const shots = [];

// ---- 1. 主役: リポジトリのタブに日本語が添えられている ----
await open(REPO);
shots.push({
  name: '01-labels',
  headline: '英語はそのまま。意味だけ、そっと添える。',
  sub: 'Pull requests が「変更の取り込み依頼」だと、ひと目でわかります。',
  raw: await capture('01'),
  // ナビのタブ（y≈149）を中心に、上のリポジトリ名の行と下の枝／目印の行まで入れる
  region: await regionOfLabels(['Code', 'Issues', 'Pull requests', 'Actions'], {
    grow: { top: 60, bottom: 76, left: 24 },
    maxWidth: 770,
    maxHeight: 230,
  }),
});

// ---- 2. ツールチップ ----
await open(REPO);
{
  // 宣伝バー（高さ 72px）を画面外に送る。ツールチップは上に出ると黒バーに重なるため。
  // スクロールはツールチップを閉じるので、必ずホバーより前に済ませる。
  await page.evaluate(() => window.scrollTo(0, 110));
  await page.waitForTimeout(900);

  const tip = page.locator('.ghja-tip.is-visible');
  let ok = false;
  for (const word of ['Pull requests', 'Issues', 'Actions']) {
    const target = page.locator('.ghja--has-tip').filter({ hasText: word }).first();
    if (!(await target.count())) continue;
    await target.hover();
    await page.waitForTimeout(600);
    if (await tip.count()) { ok = true; break; }
  }
  if (!ok) throw new Error('ツールチップを表示できませんでした');
  shots.push({
    name: '02-tooltip',
    headline: 'わからない用語は、マウスを乗せるだけ。',
    sub: '専門用語を使わない説明が出ます。読んでいるうちに覚えられます。',
    raw: await capture('02'),
    region: await regionOfLabels(['Code', 'Issues', 'Pull requests', 'Actions'], {
      grow: { left: 24, bottom: 120 },
      maxWidth: 770,
      maxHeight: 260,
      extra: ['.ghja-tip'],
    }),
  });
}

// ---- 3. 本文やコードには手を出さない ----
await open(`${REPO}/blob/main/src/glossary.js`);
shots.push({
  name: '03-safe',
  headline: 'コードや本文には、いっさい手を出しません。',
  sub: 'ナビやボタンのラベルだけ。コード・入力欄・検索欄はそのままです。',
  raw: await capture('03'),
  // ナビには日本語が付き、その下のコード本体には何も付いていないことを見せる
  region: await regionOfLabels(['Code', 'Issues', 'Pull requests', 'Actions'], {
    grow: { top: 60, bottom: 300, left: 24 },
    maxWidth: 770,
    maxHeight: 400,
  }),
});

// ---- 4. ダークモード ----
await open(REPO, { dark: true });
shots.push({
  name: '04-dark',
  headline: 'ダークモードでも読みやすく。',
  sub: '色は周囲から受け継ぐので、どんな配色にもなじみます。',
  raw: await capture('04'),
  region: await regionOfLabels(['Code', 'Issues', 'Pull requests', 'Actions'], {
    grow: { top: 60, bottom: 76, left: 24 },
    maxWidth: 770,
    maxHeight: 230,
  }),
  dark: true,
});

await ctx.close();

// ---- 組み版: 切り出した画面に見出しを付けて 1280x800 に組む ----

const PAD = 56;
const CARD_TOP = 224;

function compose({ headline, sub, raw, region, dark }) {
  const areaW = CANVAS.width - PAD * 2;
  const areaH = CANVAS.height - CARD_TOP - PAD;
  // 切り出した範囲を、置ける場所いっぱいまで拡大する（縮小はしない）
  const scale = Math.min(areaW / region.width, areaH / region.height);
  const cardW = Math.round(region.width * scale);
  const cardH = Math.round(region.height * scale);
  const cardX = Math.round(PAD + (areaW - cardW) / 2);
  const cardY = Math.round(CARD_TOP + (areaH - cardH) / 2);
  const imgW = SHOT.width * scale;
  const offX = -region.left * scale;
  const offY = -region.top * scale;
  const data = fs.readFileSync(raw).toString('base64');

  const ink = dark ? '#e6edf3' : '#1f2328';
  const muted = dark ? '#9198a1' : '#59636e';
  const bg = dark
    ? 'linear-gradient(160deg, #0d1117 0%, #161b22 100%)'
    : 'linear-gradient(160deg, #eef3f9 0%, #e3ebf5 100%)';
  const chipBg = dark ? 'rgba(255,255,255,.08)' : 'rgba(9,105,218,.09)';
  const chipInk = dark ? '#9198a1' : '#0969da';

  return `<!doctype html><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    width:${CANVAS.width}px; height:${CANVAS.height}px; overflow:hidden;
    background:${bg}; color:${ink};
    font-family:'Hiragino Sans','Noto Sans JP',-apple-system,BlinkMacSystemFont,sans-serif;
    -webkit-font-smoothing:antialiased;
  }
  .head { padding:${PAD}px ${PAD}px 0; }
  h1 { font-size:42px; font-weight:700; letter-spacing:.01em; line-height:1.25; }
  p  { margin-top:14px; font-size:19px; color:${muted}; line-height:1.5; }
  .chips { margin-top:18px; display:flex; gap:8px; }
  .chip {
    font-size:13px; font-weight:600; color:${chipInk}; background:${chipBg};
    padding:5px 12px; border-radius:99px;
  }
  .frame {
    position:absolute; left:${cardX}px; top:${cardY}px;
    width:${cardW}px; height:${cardH}px;
    border-radius:12px; overflow:hidden;
    box-shadow:0 18px 44px rgba(16,24,40,${dark ? '.55' : '.18'});
    background:${dark ? '#0d1117' : '#ffffff'};
  }
  .frame img { display:block; width:${imgW}px; margin-left:${offX}px; margin-top:${offY}px; }
  /* 端で文字が途中で切れると雑に見えるので、続いていることが伝わるようぼかす */
  .fade-r, .fade-b { position:absolute; }
  .fade-r {
    top:0; right:0; width:96px; height:100%;
    background:linear-gradient(to right, ${dark ? 'rgba(13,17,23,0)' : 'rgba(255,255,255,0)'} 0%, ${dark ? '#0d1117' : '#ffffff'} 88%);
  }
  .fade-b {
    left:0; bottom:0; width:100%; height:56px;
    background:linear-gradient(to bottom, ${dark ? 'rgba(13,17,23,0)' : 'rgba(255,255,255,0)'} 0%, ${dark ? '#0d1117' : '#ffffff'} 90%);
  }
</style>
<div class="head">
  <h1>${headline}</h1>
  <p>${sub}</p>
  <div class="chips">
    <span class="chip">外部送信なし</span>
    <span class="chip">権限は storage のみ</span>
    <span class="chip">github.com でのみ動作</span>
  </div>
</div>
<div class="frame"><img src="data:image/png;base64,${data}"><span class="fade-r"></span><span class="fade-b"></span></div>`;
}

const renderer = await chromium.launch();
const canvas = await renderer.newPage({
  viewport: CANVAS,
  deviceScaleFactor: 1, // ストアは 1280x800 ちょうどしか受け付けない
});

for (const shot of shots) {
  if (!shot.region) throw new Error(`${shot.name}: 切り出す範囲を特定できませんでした`);
  await canvas.setContent(compose(shot));
  await canvas.waitForTimeout(250);
  await canvas.screenshot({ path: path.join(OUT, `${shot.name}.png`) });
  console.log(`${shot.name.padEnd(12)} → store-assets/${shot.name}.png`);
}

await renderer.close();
fs.rmSync(TMP, { recursive: true, force: true });

// ストアが受け付けるのは 1280x800 か 640x400 だけ。取り違えないよう検査する。
function pngSize(file) {
  const buf = fs.readFileSync(file);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

let bad = 0;
console.log('\n--- 画像サイズの確認 ---');
for (const file of fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).sort()) {
  const { width, height } = pngSize(path.join(OUT, file));
  const ok = width === CANVAS.width && height === CANVAS.height;
  if (!ok) bad++;
  console.log(`  ${ok ? 'OK ' : 'NG '} ${file.padEnd(16)} ${width}x${height}`);
}
if (bad) { console.error(`\n${bad} 件がサイズ違反です。`); process.exit(1); }
console.log(`\nすべて ${CANVAS.width}x${CANVAS.height}。store-assets/ をそのまま提出できます。`);
