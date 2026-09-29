import { lookup, isExcludedElement } from './match.js';
import { DEFAULTS } from './settings.js';

// DOM の走査と書き換え。
// 仕組みは 3 つだけ:
//   1. TreeWalker で本文以外のテキストノードを集める
//   2. 辞書と完全一致したものだけ <span class="ghja"> で包み、日本語を添える
//   3. MutationObserver で SPA 遷移後に再走査する

const WRAPPER_CLASS = 'ghja';
const LABEL_CLASS = 'ghja-ja';
const TOOLTIP_CLASS = 'ghja-tip';

// ラベルとして現実的な長さの上限。これを超えるテキストノードは即座に捨てる
const MAX_LABEL_LENGTH = 40;

let options = { ...DEFAULTS };
let observer = null;
let pendingScan = null;
let sharedTooltip = null;

export function setOptions(patch) {
  options = { ...options, ...patch };
  applyStyleOptions();
}

function applyStyleOptions() {
  const root = document.documentElement;
  root.style.setProperty('--ghja-font-scale', `${options.fontScale}%`);
  root.style.setProperty('--ghja-opacity', String(options.opacity / 100));
}

/**
 * root 以下を走査して注釈を付ける。
 * @param {Node} root
 */
export function annotate(root = document.body) {
  if (!root || !document.body) return 0;
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return 0;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = node.nodeValue;
      // 安い判定から順に落とす。closest() は辞書に当たったものだけに走らせる
      if (!text || text.length > MAX_LABEL_LENGTH) return NodeFilter.FILTER_REJECT;

      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;

      const tag = parent.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TITLE') return NodeFilter.FILTER_REJECT;

      if (!lookup(text)) return NodeFilter.FILTER_REJECT;
      if (isExcludedElement(parent)) return NodeFilter.FILTER_REJECT;

      return NodeFilter.FILTER_ACCEPT;
    },
  });

  // 走査中に DOM をいじると walker が壊れるので、先に集めきる
  const targets = [];
  let node;
  while ((node = walker.nextNode())) {
    targets.push(node);
  }

  let count = 0;
  for (const textNode of targets) {
    if (annotateTextNode(textNode)) count++;
  }
  return count;
}

function annotateTextNode(textNode) {
  const entry = lookup(textNode.nodeValue);
  if (!entry) return false;

  const parent = textNode.parentNode;
  if (!parent) return false;

  const text = textNode.nodeValue;
  const trimmed = text.trim();
  const start = text.indexOf(trimmed);

  const fragment = document.createDocumentFragment();
  if (start > 0) {
    fragment.appendChild(document.createTextNode(text.slice(0, start)));
  }
  fragment.appendChild(createWrapper(trimmed, entry));
  const end = start + trimmed.length;
  if (end < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(end)));
  }

  parent.replaceChild(fragment, textNode);
  return true;
}

function createWrapper(displayText, entry) {
  const wrapper = document.createElement('span');
  wrapper.className = WRAPPER_CLASS;
  // 英語ラベルはそのまま残す
  wrapper.appendChild(document.createTextNode(displayText));

  if (options.showInline) {
    const label = document.createElement('span');
    label.className = LABEL_CLASS;
    label.textContent = entry.ja;
    wrapper.appendChild(label);
  }

  if (options.showTooltip) {
    wrapper.classList.add('ghja--has-tip');
    wrapper.dataset.ghjaDesc = entry.desc;
    wrapper.addEventListener('mouseenter', onEnter);
    wrapper.addEventListener('mouseleave', hideTooltip);
  }

  return wrapper;
}

// ---- ツールチップ（全注釈で 1 個を使い回す） ----

function getTooltip() {
  if (sharedTooltip && document.body.contains(sharedTooltip)) return sharedTooltip;

  sharedTooltip = document.createElement('div');
  sharedTooltip.className = TOOLTIP_CLASS;
  document.body.appendChild(sharedTooltip);

  window.addEventListener('scroll', hideTooltip, { passive: true });
  return sharedTooltip;
}

function onEnter(event) {
  const wrapper = event.currentTarget;
  const desc = wrapper.dataset.ghjaDesc;
  if (!desc) return;

  const tooltip = getTooltip();
  tooltip.textContent = desc;
  tooltip.classList.add('is-visible');

  const rect = wrapper.getBoundingClientRect();
  const tipRect = tooltip.getBoundingClientRect();
  const margin = 10;

  // 上に置けなければ下に回し、矢印の向きも入れ替える
  let top = rect.top - tipRect.height - margin;
  if (top < margin) {
    top = rect.bottom + margin;
    tooltip.classList.add('is-below');
  } else {
    tooltip.classList.remove('is-below');
  }

  let left = rect.left + rect.width / 2 - tipRect.width / 2;
  left = Math.max(margin, Math.min(left, window.innerWidth - tipRect.width - margin));

  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
}

function hideTooltip() {
  if (sharedTooltip) sharedTooltip.classList.remove('is-visible');
}

// ---- SPA 対応 ----

export function setupMutationObserver() {
  if (observer) return;

  observer = new MutationObserver((mutations) => {
    const roots = [];
    for (const mutation of mutations) {
      for (const added of mutation.addedNodes) {
        if (added.nodeType !== Node.ELEMENT_NODE) continue;
        // 自分が差し込んだものには反応しない（無限ループ防止）
        if (added.classList && added.classList.contains(WRAPPER_CLASS)) continue;
        if (added.closest && added.closest(`.${WRAPPER_CLASS}, .${TOOLTIP_CLASS}`)) continue;
        roots.push(added);
      }
    }
    if (roots.length === 0) return;

    clearTimeout(pendingScan);
    pendingScan = setTimeout(() => {
      for (const root of roots) {
        if (root.isConnected) annotate(root);
      }
    }, 100);
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

export function stopMutationObserver() {
  if (!observer) return;
  observer.disconnect();
  observer = null;
  clearTimeout(pendingScan);
}

export function removeAllAnnotations() {
  stopMutationObserver();
  hideTooltip();

  document.querySelectorAll(`.${WRAPPER_CLASS}`).forEach((wrapper) => {
    const label = wrapper.querySelector(`.${LABEL_CLASS}`);
    if (label) label.remove();
    const parent = wrapper.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(wrapper.textContent), wrapper);
    parent.normalize();
  });
}
