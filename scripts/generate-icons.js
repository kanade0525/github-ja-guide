// アイコン（16/48/128 の PNG）を生成する。
// 画像ライブラリは足さず、devDependency にすでにある Playwright の Chromium で
// SVG を描画してスクリーンショットを撮る。
//   実行: node scripts/generate-icons.js

import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = path.resolve(__dirname, '..', 'icons');
const SIZES = [16, 48, 128];

// Material Symbols の translate アイコン（24x24 座標系）
const TRANSLATE_PATH =
  'M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17' +
  'C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56' +
  'l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12z' +
  'm-2.62 7l1.62-4.33L19.12 17h-3.24z';

function svg(size) {
  // 小さいサイズでは余白を詰めないと潰れるので、サイズごとに padding を変える
  const pad = size <= 16 ? 1 : size <= 48 ? 4 : 12;
  const inner = size - pad * 2;
  const radius = size <= 16 ? 3 : Math.round(size * 0.22);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="#0969da"/>
  <g transform="translate(${pad} ${pad}) scale(${inner / 24})">
    <path d="${TRANSLATE_PATH}" fill="#ffffff"/>
  </g>
</svg>`;
}

const browser = await chromium.launch();
const page = await browser.newPage();
fs.mkdirSync(ICONS_DIR, { recursive: true });

for (const size of SIZES) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;padding:0;background:transparent}</style>${svg(size)}`
  );
  const file = path.join(ICONS_DIR, `icon-${size}.png`);
  await page.screenshot({ path: file, omitBackground: true });
  console.log(`generated ${path.relative(process.cwd(), file)}`);
}

// ストア掲載や README 用に SVG も残しておく
fs.writeFileSync(path.join(ICONS_DIR, 'icon.svg'), svg(128));
console.log('generated icons/icon.svg');

await browser.close();
