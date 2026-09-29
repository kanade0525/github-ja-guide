// chrome.storage の薄いラッパー。
// 拡張として動くときは chrome.storage.sync を使い、
// それが無い環境（E2E でページに直接注入する場合など）では既定値のまま動く。

export const DEFAULTS = {
  enabled: true,
  showInline: true,   // 英語ラベルの横に日本語を出す
  showTooltip: true,  // ホバーで説明を出す
  fontScale: 85,      // 日本語部分の大きさ（英語ラベルに対する %）
  opacity: 75,        // 日本語部分の濃さ（%）
  excludedPaths: [],  // 例: "settings" を入れるとそのパスでは動かさない
};

export const hasChromeStorage =
  typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.storage.sync;

export function loadSettings(callback) {
  if (!hasChromeStorage) {
    callback({ ...DEFAULTS });
    return;
  }
  chrome.storage.sync.get(DEFAULTS, (result) => {
    callback({ ...DEFAULTS, ...result });
  });
}

export function onSettingsChanged(callback) {
  if (!hasChromeStorage || !chrome.storage.onChanged) return;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    const patch = {};
    for (const [key, { newValue }] of Object.entries(changes)) {
      patch[key] = newValue;
    }
    callback(patch);
  });
}

/**
 * 現在の URL のパスが除外指定に当たるか。
 * @param {string[]} excludedPaths
 * @param {string} pathname
 */
export function isExcludedPath(excludedPaths, pathname) {
  if (!Array.isArray(excludedPaths) || excludedPaths.length === 0) return false;
  const lower = pathname.toLowerCase();
  return excludedPaths.some((p) => {
    const needle = String(p).trim().toLowerCase();
    return needle.length > 0 && lower.includes(needle);
  });
}
