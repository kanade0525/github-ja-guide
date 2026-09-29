// 文字列中の **強調** を安全に DOM 化する小さなヘルパー。
// innerHTML は使わない（ユーザーの入力が混ざる余地を作らないため）。

export function inline(text) {
  const fragment = document.createDocumentFragment();
  for (const [i, part] of String(text).split('**').entries()) {
    if (!part) continue;
    if (i % 2 === 1) {
      const strong = document.createElement('strong');
      strong.textContent = part;
      fragment.appendChild(strong);
    } else {
      fragment.appendChild(document.createTextNode(part));
    }
  }
  return fragment;
}

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.appendChild(inline(text));
  return node;
}
