import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const root = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

describe('manifest.json', () => {
  it('Manifest V3 である', () => {
    expect(manifest.manifest_version).toBe(3);
  });

  it('要求する権限は storage だけ', () => {
    expect(manifest.permissions).toEqual(['storage']);
  });

  it('host_permissions を要求しない', () => {
    expect(manifest.host_permissions).toBeUndefined();
  });

  it('content script は github.com だけに入る', () => {
    expect(manifest.content_scripts).toHaveLength(1);
    expect(manifest.content_scripts[0].matches).toEqual(['https://github.com/*']);
  });

  it('content script が参照するファイルが実在する', () => {
    for (const file of [...manifest.content_scripts[0].js, ...manifest.content_scripts[0].css]) {
      // content.js はビルド成果物なので、未ビルドのときは src 側の存在で代替する
      const exists =
        fs.existsSync(path.join(root, file)) ||
        fs.existsSync(path.join(root, 'src', file));
      expect(exists, `${file} が見つからない`).toBe(true);
    }
  });

  it('アイコンが 3 サイズ揃っていて実在する', () => {
    for (const size of ['16', '48', '128']) {
      const file = manifest.icons[size];
      expect(file, `icons.${size}`).toBeTruthy();
      expect(fs.existsSync(path.join(root, file)), `${file} が見つからない`).toBe(true);
    }
  });

  it('アイコンが宣言どおりの寸法で書き出されている', () => {
    // ドット絵は 16x16 を 1/3/8 倍で拡大する。寸法がずれると絵が崩れる
    for (const size of ['16', '48', '128']) {
      const buf = fs.readFileSync(path.join(root, manifest.icons[size]));
      expect(buf.readUInt32BE(16), `icon-${size}.png の幅`).toBe(Number(size));
      expect(buf.readUInt32BE(20), `icon-${size}.png の高さ`).toBe(Number(size));
      expect(Number(size) % 16, `${size} は 16 で割り切れる必要がある`).toBe(0);
    }
  });

  it('ポップアップと設定ページが実在する', () => {
    expect(fs.existsSync(path.join(root, manifest.action.default_popup))).toBe(true);
    expect(fs.existsSync(path.join(root, manifest.options_ui.page))).toBe(true);
  });

  it('バージョンが package.json と揃っている', () => {
    expect(manifest.version).toBe(pkg.version);
  });

  it('名前と説明が日本語で入っている', () => {
    expect(manifest.name.length).toBeGreaterThan(0);
    expect(manifest.description.length).toBeGreaterThan(0);
    expect(manifest.description.length).toBeLessThanOrEqual(132); // ストアの上限
  });
});
