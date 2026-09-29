const DEFAULTS = {
  fontScale: 85,
  opacity: 75,
  excludedPaths: [],
};

document.addEventListener('DOMContentLoaded', async () => {
  const fontScale = document.getElementById('fontScale');
  const opacity = document.getElementById('opacity');
  const fontScaleOut = document.getElementById('fontScaleOut');
  const opacityOut = document.getElementById('opacityOut');
  const previewJa = document.getElementById('previewJa');
  const pathInput = document.getElementById('pathInput');
  const pathList = document.getElementById('pathList');
  const pathEmpty = document.getElementById('pathEmpty');
  const saveStatus = document.getElementById('saveStatus');

  const settings = await chrome.storage.sync.get(DEFAULTS);
  let excludedPaths = [...settings.excludedPaths];

  fontScale.value = settings.fontScale;
  opacity.value = settings.opacity;
  renderPreview();
  renderPaths();

  fontScale.addEventListener('input', renderPreview);
  opacity.addEventListener('input', renderPreview);

  document.getElementById('addPath').addEventListener('click', addPath);
  pathInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addPath();
    }
  });

  document.getElementById('save').addEventListener('click', async () => {
    await chrome.storage.sync.set({
      fontScale: Number(fontScale.value),
      opacity: Number(opacity.value),
      excludedPaths,
    });
    saveStatus.textContent = '保存しました';
    saveStatus.classList.add('is-visible');
    setTimeout(() => saveStatus.classList.remove('is-visible'), 2000);
  });

  function addPath() {
    const value = pathInput.value.trim().toLowerCase();
    if (!value || excludedPaths.includes(value)) {
      pathInput.value = '';
      return;
    }
    excludedPaths.push(value);
    pathInput.value = '';
    renderPaths();
  }

  function removePath(value) {
    excludedPaths = excludedPaths.filter((p) => p !== value);
    renderPaths();
  }

  function renderPaths() {
    pathList.replaceChildren();

    for (const value of excludedPaths) {
      // ユーザー入力は textContent で入れる。innerHTML は使わない。
      const item = document.createElement('li');
      item.className = 'path-item';

      const text = document.createElement('span');
      text.textContent = value;

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn btn--ghost';
      remove.textContent = '削除';
      remove.addEventListener('click', () => removePath(value));

      item.append(text, remove);
      pathList.appendChild(item);
    }

    pathEmpty.hidden = excludedPaths.length > 0;
  }

  function renderPreview() {
    fontScaleOut.textContent = `${fontScale.value}%`;
    opacityOut.textContent = `${opacity.value}%`;
    previewJa.style.fontSize = `${fontScale.value}%`;
    previewJa.style.opacity = String(opacity.value / 100);
  }
});
