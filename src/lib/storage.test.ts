import { describe, expect, it } from 'vitest';
import { KEYS, SCHEMA_VERSION, loadData } from './storage';

class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}

describe('マイグレーション', () => {
  it('古いデータが残っていても転売仕入れカテゴリが追加され、データは消えない', () => {
    const s = new MemoryStorage();
    const oldCats = [
      { id: 'food', name: '食費', emoji: '🍙', color: '#c8f542', builtIn: true },
      { id: 'my1', name: '推し活', emoji: '⭐', color: '#ffcc00', builtIn: false },
      { id: 'other', name: 'その他', emoji: '🔖', color: '#8a8a99', builtIn: true },
    ];
    const oldEntries = [
      {
        id: 'e1',
        date: '2026-01-02',
        storeName: 'ローソン',
        paymentMethod: '現金',
        items: [{ id: 'i1', name: 'おにぎり', amount: 150, categoryId: 'food' }],
        source: 'manual',
        createdAt: '2026-01-02T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
      },
    ];
    s.setItem(KEYS.categories, JSON.stringify(oldCats));
    s.setItem(KEYS.entries, JSON.stringify(oldEntries));
    // schemaVersion なし = v1

    const data = loadData(s);
    expect(data.categories.find((c) => c.name === '転売仕入れ')).toMatchObject({ emoji: '📦', color: '#ff6b35', builtIn: true });
    expect(data.categories.find((c) => c.id === 'my1')).toBeTruthy();
    expect(data.categories.at(-1)?.id).toBe('other');
    expect(data.entries).toHaveLength(1);
    expect(data.entries[0].items[0]).toMatchObject({ name: 'おにぎり', amount: 150, categoryId: 'food' });
    expect(s.getItem(KEYS.schemaVersion)).toBe(String(SCHEMA_VERSION));
    // 保存し直したデータを読み直しても変わらない
    expect(loadData(s)).toEqual(data);
  });

  it('初回起動では標準カテゴリが入る', () => {
    const data = loadData(new MemoryStorage());
    expect(data.categories.map((c) => c.name)).toContain('転売仕入れ');
    expect(data.entries).toEqual([]);
  });

  it('壊れたJSONは消さずに退避する', () => {
    const s = new MemoryStorage();
    s.setItem(KEYS.entries, '{broken');
    loadData(s);
    const keys = Array.from({ length: s.length }, (_, i) => s.key(i));
    expect(keys.some((k) => k?.startsWith(`${KEYS.entries}.broken.`))).toBe(true);
  });
});
