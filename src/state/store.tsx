import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Category, Entry, Learned } from '../types';
import { type AppData, loadData, migrate, saveAll, SCHEMA_VERSION } from '../lib/storage';
import { learnFromEntry } from '../lib/categorize';
import { DEFAULT_CATEGORIES, OTHER_ID } from '../data/defaultCategories';

interface Store extends AppData {
  saveEntry: (e: Entry) => void;
  deleteEntry: (id: string) => void;
  setCategories: (c: Category[]) => void;
  deleteCategory: (id: string) => void;
  importData: (raw: unknown) => { entries: number; categories: number };
  clearAll: () => void;
  categoryById: (id: string) => Category;
}

const Ctx = createContext<Store | null>(null);

const FALLBACK_CAT: Category = { id: OTHER_ID, name: 'その他', emoji: '🔖', color: '#8a8a99', builtIn: true };

export function StoreProvider({ children, onError }: { children: ReactNode; onError: (msg: string) => void }) {
  const [data, setData] = useState<AppData>(() => {
    try {
      return loadData();
    } catch (e) {
      setTimeout(() => onError(`データの読み込みに失敗しました：${(e as Error).message}`));
      return { entries: [], categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })), learned: { stores: {}, items: {} } };
    }
  });

  const commit = useCallback(
    (updater: (d: AppData) => AppData) => {
      setData((prev) => {
        const next = updater(prev);
        try {
          saveAll(next);
        } catch (e) {
          onError(`保存できませんでした（容量不足の可能性）：${(e as Error).message}`);
          return prev;
        }
        return next;
      });
    },
    [onError],
  );

  const store = useMemo<Store>(() => {
    const catMap = new Map(data.categories.map((c) => [c.id, c]));
    return {
      ...data,
      categoryById: (id) => catMap.get(id) ?? catMap.get(OTHER_ID) ?? FALLBACK_CAT,
      saveEntry: (entry) =>
        commit((d) => {
          const exists = d.entries.some((e) => e.id === entry.id);
          const entries = exists ? d.entries.map((e) => (e.id === entry.id ? entry : e)) : [entry, ...d.entries];
          const learned: Learned = learnFromEntry(d.learned, entry);
          return { ...d, entries, learned };
        }),
      deleteEntry: (id) => commit((d) => ({ ...d, entries: d.entries.filter((e) => e.id !== id) })),
      setCategories: (categories) => commit((d) => ({ ...d, categories })),
      deleteCategory: (id) =>
        commit((d) => {
          const cat = d.categories.find((c) => c.id === id);
          if (!cat || cat.builtIn) return d;
          // 使用中のカテゴリは「その他」に移す
          const entries = d.entries.map((e) =>
            e.items.some((i) => i.categoryId === id)
              ? { ...e, items: e.items.map((i) => (i.categoryId === id ? { ...i, categoryId: OTHER_ID } : i)) }
              : e,
          );
          const drop = (r: Record<string, string>) => Object.fromEntries(Object.entries(r).filter(([, v]) => v !== id));
          return {
            entries,
            categories: d.categories.filter((c) => c.id !== id),
            learned: { stores: drop(d.learned.stores), items: drop(d.learned.items) },
          };
        }),
      importData: (raw) => {
        const r = (typeof raw === 'object' && raw ? raw : {}) as Record<string, unknown>;
        const incoming = migrate({
          entries: r.entries,
          categories: r.categories,
          learned: r.learned,
          schemaVersion: Number(r.schemaVersion) || 1,
        });
        commit((d) => {
          // 同じIDは上書き、それ以外は追加（マージ）
          const cats = [...d.categories];
          for (const c of incoming.categories) {
            const i = cats.findIndex((x) => x.id === c.id);
            if (i >= 0) cats[i] = { ...c, builtIn: cats[i].builtIn };
            else cats.splice(Math.max(0, cats.length - 1), 0, c);
          }
          const map = new Map(d.entries.map((e) => [e.id, e]));
          for (const e of incoming.entries) map.set(e.id, e);
          const merged = migrate({ entries: [...map.values()], categories: cats, learned: d.learned, schemaVersion: SCHEMA_VERSION });
          return {
            ...merged,
            entries: merged.entries.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
            learned: {
              stores: { ...incoming.learned.stores, ...d.learned.stores },
              items: { ...incoming.learned.items, ...d.learned.items },
            },
          };
        });
        return { entries: incoming.entries.length, categories: incoming.categories.length };
      },
      clearAll: () =>
        commit(() => ({ entries: [], categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })), learned: { stores: {}, items: {} } })),
    };
  }, [data, commit]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider がありません');
  return s;
}
