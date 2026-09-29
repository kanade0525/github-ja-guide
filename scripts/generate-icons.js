// アイコン（16/48/128 の PNG）を生成する。
// 画像ライブラリは足さず、devDependency にある Playwright の Chromium で描画する。
//   実行: npm run icons
//
// 16x16 のドット絵を 1 マス = 1/3/8 ピクセルで拡大するので、
// どのサイズでもドットが崩れない（16→1倍, 48→3倍, 128→8倍）。
//
// 意匠について: GitHub のマスコット（Octocat）は GitHub の商標・著作物であり、
// 他社製品のアイコンに使うことはできない。ここで描くのは一般的な猫であって、
// Octocat の模倣ではない（触手なし、輪郭も配色も別物）。

import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = path.resolve(__dirname, '..', 'icons');
const GRID = 16;
const SIZES = [16, 48, 128];

const BG = '#24292f'; // 地の色（GitHub の文字色と同じ黒）

const PALETTE = {
  W: '#ffffff', // 毛
  E: BG,        // 目。地と同じ色で抜くと、白い顔に穴が空いて見える
  N: '#8c959f', // 鼻
  P: '#d0d7de', // 耳の内側
};

// 16x16。'.' は背景（青）のまま
// 上を細く、頬を広く、顎を絞ることで猫の輪郭にする。
// 耳は頭から独立して立ち上がらせ、間に谷を作る（切り欠きに見えないように）
const CAT = [
  '................',
  '................',
  '...W........W...',
  '...WW......WW...',
  '...WPW....WPW...',
  '...WWWWWWWWWW...',
  '..WWWWWWWWWWWW..',
  '..WWEEWWWWEEWW..',
  '..WWEEWWWWEEWW..',
  '..WWWWWWWWWWWW..',
  '..WWWWWNNWWWWW..',
  '..WWWWWWWWWWWW..',
  '...WWWWWWWWWW...',
  '....WWWWWWWW....',
  '................',
  '................',
];

// 作る前に、絵が崩れていないか検査する（1 行でも長さが違うと全体がずれる）
CAT.forEach((row, y) => {
  if (row.length !== GRID) {
    throw new Error(`ドット絵の ${y} 行目が ${row.length} マス（${GRID} マスであるべき）`);
  }
  for (const ch of row) {
    if (ch !== '.' && !PALETTE[ch]) throw new Error(`${y} 行目に未定義の記号 "${ch}"`);
  }
});
if (CAT.length !== GRID) throw new Error(`ドット絵が ${CAT.length} 行（${GRID} 行であるべき）`);

function svg(size) {
  const cell = size / GRID;
  if (!Number.isInteger(cell)) throw new Error(`${size}px は ${GRID} で割り切れない`);

  const radius = Math.round(cell * 3); // 角丸も 3 マス分にして、ドットの粒度に合わせる
  const cells = [];
  CAT.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      cells.push(
        `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="${PALETTE[ch]}"/>`
      );
    });
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${BG}"/>
  ${cells.join('\n  ')}
</svg>`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
fs.mkdirSync(ICONS_DIR, { recursive: true });

for (const size of SIZES) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;padding:0;background:transparent}</style>${svg(size)}`);
  const file = path.join(ICONS_DIR, `icon-${size}.png`);
  await page.screenshot({ path: file, omitBackground: true });
  console.log(`generated ${path.relative(process.cwd(), file)}`);
}

fs.writeFileSync(path.join(ICONS_DIR, 'icon.svg'), svg(128));
console.log('generated icons/icon.svg');

await browser.close();
