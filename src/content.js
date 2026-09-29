import { annotate, setupMutationObserver, stopMutationObserver, removeAllAnnotations, setOptions } from './dom.js';
import { DEFAULTS, loadSettings, onSettingsChanged, isExcludedPath } from './settings.js';

let settings = { ...DEFAULTS };
let running = false;

function shouldRun() {
  return settings.enabled && !isExcludedPath(settings.excludedPaths, window.location.pathname);
}

function start() {
  if (running) return;
  running = true;
  setOptions(settings);
  annotate(document.body);
  setupMutationObserver();
}

function stop() {
  if (!running) return;
  running = false;
  stopMutationObserver();
  removeAllAnnotations();
}

function sync() {
  if (shouldRun()) {
    if (running) {
      // 表示方式が変わったときは付け直す
      stop();
    }
    start();
  } else {
    stop();
  }
}

loadSettings((loaded) => {
  settings = loaded;
  sync();
});

onSettingsChanged((patch) => {
  settings = { ...settings, ...patch };
  sync();
});

// E2E / デバッグ用。content script は分離された世界で動くため、ページ側からは見えない。
window.__ghja = { annotate, removeAllAnnotations, setOptions, getSettings: () => ({ ...settings }) };
