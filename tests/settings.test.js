import { describe, it, expect } from 'vitest';
import { DEFAULTS, isExcludedPath } from '../src/settings.js';

describe('DEFAULTS', () => {
  it('既定で有効・横に日本語・ツールチップあり', () => {
    expect(DEFAULTS.enabled).toBe(true);
    expect(DEFAULTS.showInline).toBe(true);
    expect(DEFAULTS.showTooltip).toBe(true);
  });

  it('見た目の既定値が妥当な範囲にある', () => {
    expect(DEFAULTS.fontScale).toBeGreaterThanOrEqual(50);
    expect(DEFAULTS.fontScale).toBeLessThanOrEqual(150);
    expect(DEFAULTS.opacity).toBeGreaterThan(0);
    expect(DEFAULTS.opacity).toBeLessThanOrEqual(100);
  });
});

describe('isExcludedPath', () => {
  it('指定なしなら除外しない', () => {
    expect(isExcludedPath([], '/octocat/hello/settings')).toBe(false);
    expect(isExcludedPath(undefined, '/octocat/hello')).toBe(false);
  });

  it('パスに含まれていれば除外する', () => {
    expect(isExcludedPath(['settings'], '/octocat/hello/settings')).toBe(true);
    expect(isExcludedPath(['settings'], '/octocat/hello/issues')).toBe(false);
  });

  it('大文字小文字を無視する', () => {
    expect(isExcludedPath(['SETTINGS'], '/octocat/hello/settings')).toBe(true);
  });

  it('空文字だけの指定は無視する', () => {
    expect(isExcludedPath(['', '  '], '/octocat/hello')).toBe(false);
  });
});
