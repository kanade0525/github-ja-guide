import { describe, it, expect } from 'vitest';
import { lookup, isExcludedElement, EXCLUDE_SELECTOR } from '../src/match.js';

describe('lookup', () => {
  it('辞書にあるラベルに一致する', () => {
    expect(lookup('Pull requests')?.ja).toBe('変更の取り込み依頼');
    expect(lookup('Fork')?.ja).toBe('自分用にコピー');
    expect(lookup('Squash and merge')?.ja).toBe('まとめて取り込む');
  });

  it('前後の空白・改行を無視する', () => {
    expect(lookup('  Fork  ')?.key).toBe('Fork');
    expect(lookup('\n  Pull requests\n  ')?.key).toBe('Pull requests');
  });

  it('連続する空白を 1 つに詰めて照合する', () => {
    expect(lookup('Pull   requests')?.key).toBe('Pull requests');
  });

  it('大文字小文字を無視する', () => {
    expect(lookup('fork')?.key).toBe('Fork');
    expect(lookup('FORK')?.key).toBe('Fork');
    expect(lookup('pull Requests')?.key).toBe('Pull requests');
  });

  it('部分一致では反応しない（誤爆防止の要）', () => {
    expect(lookup('Forked from octocat/hello')).toBeNull();
    expect(lookup('この機能を fork して試した')).toBeNull();
    expect(lookup('git merge main')).toBeNull();
    expect(lookup('Issues found: 3')).toBeNull();
    expect(lookup('Code owners file')).toBeNull();
    expect(lookup('Search results')).toBeNull();
  });

  it('辞書にない語は null', () => {
    expect(lookup('Bananas')).toBeNull();
  });

  it('空・空白のみ・非文字列は null', () => {
    expect(lookup('')).toBeNull();
    expect(lookup('   ')).toBeNull();
    expect(lookup('\n\t')).toBeNull();
    expect(lookup(null)).toBeNull();
    expect(lookup(undefined)).toBeNull();
    expect(lookup(42)).toBeNull();
  });

  it('返り値は凍結されていて呼び出し側から壊せない', () => {
    const entry = lookup('Fork');
    expect(Object.isFrozen(entry)).toBe(true);
  });
});

describe('isExcludedElement', () => {
  const fakeElement = (matches) => ({
    closest: (selector) => (selector === EXCLUDE_SELECTOR && matches ? {} : null),
  });

  it('除外領域の中なら true', () => {
    expect(isExcludedElement(fakeElement(true))).toBe(true);
  });

  it('除外領域の外なら false', () => {
    expect(isExcludedElement(fakeElement(false))).toBe(false);
  });

  it('要素がないときは安全側に倒して true', () => {
    expect(isExcludedElement(null)).toBe(true);
    expect(isExcludedElement(undefined)).toBe(true);
    expect(isExcludedElement({})).toBe(true);
  });
});

describe('EXCLUDE_SELECTOR', () => {
  it('本文・コード・入力欄・自分の挿入分を含む', () => {
    const needed = [
      '.markdown-body', 'pre', 'code', 'textarea', 'input', '.ghja',
      '[role="search"]', '[role="combobox"]', '[role="textbox"]', '[contenteditable="true"]',
    ];
    for (const selector of needed) {
      expect(EXCLUDE_SELECTOR).toContain(selector);
    }
  });
});
