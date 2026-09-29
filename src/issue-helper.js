// Issue を新しく書く画面に、依頼の雛形と書き方の要点を差し込む。
//
// 用語を訳すだけでは「何をどう書けば伝わるか」は解決しない。
// エンジニアでない人がいちばん詰まるのはここなので、書く場所のすぐ上に置く。

import { CONCEPTS } from './concepts.js';
import { el } from './render.js';

const PANEL_ID = 'ghja-issue-helper';
const ISSUE_TEMPLATES = CONCEPTS.find((c) => c.id === 'issue')?.templates || [];

const CHECKLIST = [
  '**何が起きたか**と**どうなってほしいか**を分けて書く',
  'そうなる**手順**を書く（再現できると原因特定が何倍も速くなります）',
  '画面の**写真**を貼る。エラーの文字はそのままコピーして貼る',
  '**期限と急ぎ具合**を書く（書かないと「急ぎではない」と読まれます）',
];

function isNewIssuePage() {
  return /\/issues\/new(\/|$|\?)/.test(location.pathname + location.search);
}

/** GitHub の本文入力欄を探す。作りが変わりやすいので候補を順に試す */
function findBodyField() {
  const candidates = [
    'textarea[name="issue[body]"]',
    'textarea#issue_body',
    '[data-testid="issue-body-textarea"] textarea',
    'form textarea',
  ];
  for (const selector of candidates) {
    const field = document.querySelector(selector);
    if (field && field.offsetParent !== null) return field;
  }
  return null;
}

function insertIntoField(text) {
  const field = findBodyField();
  if (!field) return false;

  // すでに書かれているものを消さない
  field.value = field.value.trim() ? `${field.value.trimEnd()}\n\n${text}` : text;
  // React 側に変更を伝える
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.focus();
  return true;
}

function buildPanel() {
  const panel = el('section', 'ghja-panel');
  panel.id = PANEL_ID;

  const head = el('div', 'ghja-panel__head');
  head.appendChild(el('h2', null, '伝わる依頼の書き方'));

  // 拡張として動いていないとき（テストなど）は chrome が無いのでリンクを出さない
  const guideUrl =
    typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL('guide.html#issue')
      : null;
  if (guideUrl) {
    const guide = el('a', 'ghja-panel__link', 'くわしいガイドを開く');
    guide.href = guideUrl;
    guide.target = '_blank';
    guide.rel = 'noreferrer';
    head.appendChild(guide);
  }
  panel.appendChild(head);

  const list = el('ul', 'ghja-panel__list');
  for (const item of CHECKLIST) list.appendChild(el('li', null, item));
  panel.appendChild(list);

  const actions = el('div', 'ghja-panel__actions');
  actions.appendChild(el('span', 'ghja-panel__label', '雛形を入れる:'));

  for (const template of ISSUE_TEMPLATES) {
    const button = el('button', 'ghja-panel__btn', template.label);
    button.type = 'button';
    button.addEventListener('click', async () => {
      if (insertIntoField(template.body)) {
        flash(button, '本文に入れました');
        return;
      }
      try {
        await navigator.clipboard.writeText(template.body);
        flash(button, 'コピーしました（貼り付けてください）');
      } catch {
        flash(button, 'うまくいきませんでした');
      }
    });
    actions.appendChild(button);
  }
  panel.appendChild(actions);

  panel.appendChild(
    el('p', 'ghja-panel__note', 'この案内は書き込む人にだけ見えています。投稿内容には含まれません。')
  );
  return panel;
}

function flash(button, message) {
  const original = button.textContent;
  button.textContent = message;
  button.disabled = true;
  setTimeout(() => {
    button.textContent = original;
    button.disabled = false;
  }, 2000);
}

/** 差し込む場所。フォームの直前が理想だが、無ければ本文領域の先頭に置く */
function findAnchor() {
  return (
    document.querySelector('[data-testid="issue-form"]') ||
    document.querySelector('main form') ||
    document.querySelector('main') ||
    null
  );
}

/** URL に応じてパネルを出し入れする。SPA 遷移のたびに呼ばれる */
export function syncIssueHelper(enabled) {
  const existing = document.getElementById(PANEL_ID);

  if (!enabled || !isNewIssuePage()) {
    existing?.remove();
    return false;
  }
  if (existing) return true;

  const anchor = findAnchor();
  if (!anchor) return false;

  const panel = buildPanel();
  if (anchor.tagName === 'MAIN') anchor.prepend(panel);
  else anchor.parentNode.insertBefore(panel, anchor);
  return true;
}
