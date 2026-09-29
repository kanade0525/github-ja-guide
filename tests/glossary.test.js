import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { GLOSSARY, GLOSSARY_INDEX } from '../src/glossary.js';

describe('GLOSSARY', () => {
  const entries = Object.entries(GLOSSARY);

  it('十分な語数がある', () => {
    expect(entries.length).toBeGreaterThanOrEqual(80);
  });

  it('すべての項目に ja と desc がある', () => {
    for (const [key, value] of entries) {
      expect(value.ja, `${key} の ja`).toBeTruthy();
      expect(value.desc, `${key} の desc`).toBeTruthy();
    }
  });

  it('ja と desc に前後の空白がない', () => {
    for (const [key, value] of entries) {
      expect(value.ja, `${key} の ja`).toBe(value.ja.trim());
      expect(value.desc, `${key} の desc`).toBe(value.desc.trim());
    }
  });

  it('日本語が長すぎない（横に添えるため）', () => {
    for (const [key, value] of entries) {
      expect(value.ja.length, `${key} の ja が長い: ${value.ja}`).toBeLessThanOrEqual(12);
    }
  });

  it('説明が言い換えの丸写しになっていない', () => {
    for (const [key, value] of entries) {
      expect(value.desc, `${key}`).not.toBe(value.ja);
      expect(value.desc.length, `${key} の desc が短すぎる`).toBeGreaterThan(10);
    }
  });

  it('大文字小文字を無視したキーの重複がない', () => {
    expect(Object.keys(GLOSSARY_INDEX).length).toBe(entries.length);
  });

  it('索引は元のキーの綴りを保持している', () => {
    for (const [key] of entries) {
      expect(GLOSSARY_INDEX[key.toLowerCase()].key).toBe(key);
    }
  });

  // JS のオブジェクトリテラルは同じキーを 2 回書いても黙って後勝ちになる。
  // 先に書いた訳が気付かないうちに消えるので、ソースの字面で検出する。
  it('ソース上に同じキーを 2 回書いていない', () => {
    const source = fs.readFileSync(
      path.join(import.meta.dirname, '..', 'src', 'glossary.js'),
      'utf8'
    );
    const keys = [...source.matchAll(/^ {2}'([^']+)': \{/gm)].map((m) => m[1]);
    const duplicated = keys.filter((k, i) => keys.indexOf(k) !== i);
    expect([...new Set(duplicated)]).toEqual([]);
    expect(keys.length).toBe(Object.keys(GLOSSARY).length);
  });

  it('キーに前後の空白や連続空白がない', () => {
    for (const [key] of entries) {
      expect(key).toBe(key.trim());
      expect(key).not.toMatch(/\s{2,}/);
    }
  });
});
