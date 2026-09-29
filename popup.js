const DEFAULTS = {
  enabled: true,
  showInline: true,
  showTooltip: true,
};

document.addEventListener('DOMContentLoaded', async () => {
  const enabled = document.getElementById('enabled');
  const modeGroup = document.getElementById('modeGroup');
  const note = document.getElementById('note');

  const settings = await chrome.storage.sync.get(DEFAULTS);

  enabled.checked = settings.enabled !== false;
  const mode = settings.showInline === false ? 'tooltip' : 'inline';
  modeGroup.querySelector(`input[value="${mode}"]`).checked = true;
  reflectDisabledState();

  // 保存するだけでよい。content script は chrome.storage.onChanged を見て
  // その場で付け替えるので、タブへの個別通知（= tabs 権限）は要らない。
  enabled.addEventListener('change', async () => {
    await chrome.storage.sync.set({ enabled: enabled.checked });
    reflectDisabledState();
    flash(enabled.checked ? '表示をオンにしました' : '表示をオフにしました');
  });

  modeGroup.addEventListener('change', async (event) => {
    if (event.target.name !== 'mode') return;
    const inline = event.target.value === 'inline';
    await chrome.storage.sync.set({ showInline: inline, showTooltip: true });
    flash('表示のしかたを変えました');
  });

  document.getElementById('openOptions').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  function reflectDisabledState() {
    modeGroup.disabled = !enabled.checked;
  }

  let flashTimer;
  function flash(message) {
    note.textContent = message;
    note.classList.add('is-active');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      note.textContent = 'GitHub のページを開くと反映されます。';
      note.classList.remove('is-active');
    }, 1800);
  }
});
