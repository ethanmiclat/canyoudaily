import { afterEach, describe, expect, it, vi } from 'vitest';
import { dayKey, readJSON, readMeta, writeJSON, META_KEY } from './storage';

function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('storage', () => {
  it('namespaces keys', () => {
    expect(dayKey('survive', '2026-10-12')).toBe('cy:v1:survive:2026-10-12');
    expect(META_KEY).toBe('cy:v1:meta');
  });

  it('round-trips JSON', () => {
    vi.stubGlobal('window', { localStorage: fakeStorage() });
    expect(writeJSON('k', { a: 1 })).toBe(true);
    expect(readJSON('k')).toEqual({ a: 1 });
  });

  it('never throws when storage is blocked or corrupt', () => {
    vi.stubGlobal('window', {
      get localStorage(): Storage {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
    expect(readJSON('k')).toBeNull();
    expect(writeJSON('k', 1)).toBe(false);
    expect(readMeta().streak).toBe(0);

    const s = fakeStorage();
    s.setItem('bad', '{not json');
    vi.stubGlobal('window', { localStorage: s });
    expect(readJSON('bad')).toBeNull();
  });

  it('works with no window (server)', () => {
    expect(readJSON('k')).toBeNull();
  });
});
