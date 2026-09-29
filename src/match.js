import { GLOSSARY_INDEX } from './glossary.js';

// 注釈を付けない領域。
// セレクタで「ナビだけを狙う」方式は GitHub の class 名がよく変わるため採らず、
// 「本文・入力欄・コードを除外する」引き算で誤爆を防ぐ。
export const EXCLUDE_SELECTOR = [
  '.markdown-body',
  '.js-comment-body',
  '[data-testid$="-body"]',
  'pre',
  'code',
  'textarea',
  'input',
  'option',
  // GitHub の検索・フィルタ欄は <input> ではなく role 付きのウィジェットで、
  // 中のトークン（state:open など）が素の span になっている。
  // ここに注釈を入れると入力中の文字列を壊しかねないので必ず除外する。
  '[role="search"]',
  '[role="combobox"]',
  '[role="searchbox"]',
  '[role="textbox"]',
  '.QueryBuilder',
  '.blob-code',
  '.react-code-text',
  '[contenteditable="true"]',
  '.ghja',
].join(', ');

/**
 * テキストノードの中身が辞書のラベルと完全一致するかを調べる。
 * 部分一致は取らない。文章中の "forked from x" などに反応させないため。
 *
 * @param {string} text テキストノードの中身
 * @returns {{key: string, ja: string, desc: string}|null}
 */
export function lookup(text) {
  if (typeof text !== 'string') return null;

  // 前後の空白と、ラベル末尾に付く記号（カウンタの区切りなど）を落とす
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;

  return GLOSSARY_INDEX[normalized.toLowerCase()] || null;
}

/**
 * この要素（またはその祖先）が除外領域かどうか。
 * @param {{closest?: (s: string) => unknown}} element
 * @returns {boolean}
 */
export function isExcludedElement(element) {
  if (!element || typeof element.closest !== 'function') return true;
  return element.closest(EXCLUDE_SELECTOR) !== null;
}
