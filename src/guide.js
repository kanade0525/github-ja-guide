// 拡張機能に同梱する読み物ページ（guide.html）の中身を組み立てる。
// 用語の言い換えだけでは伝わらない「概念」と「依頼の雛形」を置く場所。

import { INTRO, CONCEPTS } from './concepts.js';
import { el } from './render.js';

const main = document.getElementById('main');
const nav = document.getElementById('nav');

function renderIntro() {
  const section = el('section', 'card');
  section.id = INTRO.id;
  section.appendChild(el('h2', null, INTRO.title));
  section.appendChild(el('p', 'lead', INTRO.lead));

  const dl = el('dl', 'pair');
  for (const [term, desc] of INTRO.body) {
    dl.appendChild(el('dt', null, term));
    dl.appendChild(el('dd', null, desc));
  }
  section.appendChild(dl);
  section.appendChild(el('p', 'note', INTRO.note));
  main.appendChild(section);
}

function renderCompare(compare) {
  const wrap = el('div', 'compare');

  const bad = el('div', 'compare__col compare__col--bad');
  bad.appendChild(el('h4', null, '伝わりにくい'));
  const badList = el('ul');
  for (const item of compare.bad) badList.appendChild(el('li', null, item));
  bad.appendChild(badList);

  const good = el('div', 'compare__col compare__col--good');
  good.appendChild(el('h4', null, '伝わりやすい'));
  const goodList = el('ul');
  for (const item of compare.good) goodList.appendChild(el('li', null, item));
  good.appendChild(goodList);

  wrap.append(bad, good);
  return wrap;
}

function renderTemplates(templates) {
  const wrap = el('div', 'templates');
  wrap.appendChild(el('h3', null, 'そのまま使える雛形'));
  wrap.appendChild(
    el('p', 'note', 'コピーして Issue の本文に貼ってください。埋まらない項目は消して構いません。')
  );

  for (const template of templates) {
    const box = el('div', 'template');
    const head = el('div', 'template__head');
    head.appendChild(el('h4', null, template.label));

    const copy = el('button', 'btn', 'コピー');
    copy.type = 'button';
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(template.body);
        copy.textContent = 'コピーしました';
      } catch {
        copy.textContent = 'コピーできませんでした';
      }
      setTimeout(() => (copy.textContent = 'コピー'), 1800);
    });
    head.appendChild(copy);

    const pre = el('pre');
    pre.textContent = template.body;

    box.append(head, pre);
    wrap.appendChild(box);
  }
  return wrap;
}

function renderConcept(concept) {
  const section = el('section', 'card');
  section.id = concept.id;
  section.appendChild(el('h2', null, concept.title));
  section.appendChild(el('p', 'lead', concept.lead));

  for (const part of concept.sections) {
    section.appendChild(el('h3', null, part.heading));
    for (const text of part.paragraphs || []) section.appendChild(el('p', null, text));
    if (part.list) {
      const ul = el('ul');
      for (const item of part.list) ul.appendChild(el('li', null, item));
      section.appendChild(ul);
    }
    if (part.compare) section.appendChild(renderCompare(part.compare));
    if (part.note) section.appendChild(el('p', 'note', part.note));
  }

  if (concept.templates) section.appendChild(renderTemplates(concept.templates));
  main.appendChild(section);
}

function renderNav() {
  const items = [[INTRO.id, 'はじめに'], ...CONCEPTS.map((c) => [c.id, c.term])];
  for (const [id, label] of items) {
    const link = el('a', null, label);
    link.href = `#${id}`;
    nav.appendChild(link);
  }
}

renderNav();
renderIntro();
for (const concept of CONCEPTS) renderConcept(concept);

// 別ページから #issue などを指定して開かれたときに、その位置へ送る
if (location.hash) {
  document.querySelector(location.hash)?.scrollIntoView();
}
