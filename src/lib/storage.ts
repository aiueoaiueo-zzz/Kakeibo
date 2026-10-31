import type { Category, Entry, Item, Learned, PaymentMethod } from '../types';
import { PAYMENT_METHODS } from '../types';
import { DEFAULT_CATEGORIES, OTHER_ID } from '../data/defaultCategories';
import { uid } from './id';

export const KEYS = {
  entries: 'kakeibo.entries',
  categories: 'kakeibo.categories',
  schemaVersion: 'kakeibo.schemaVersion',
  learned: 'kakeibo.learned',
} as const;

/**
 * 現在のデータ構造のバージョン。
 * データ構造を変えるときはここを上げて MIGRATIONS に移行処理を追加する。
 *  v1: 初期版（転売仕入れカテゴリなし）
 *  v2: 転売仕入れカテゴリ追加、データの整形
 */
export const SCHEMA_VERSION = 2;

export interface AppData {
  entries: Entry[];
  categories: Category[];
  learned: Learned;
}

export interface RawData {
  entries: unknown;
  categories: unknown;
  learned: unknown;
  schemaVersion: number;
}

type Migration = (d: AppData) => AppData;

/** version N → N+1 の移行処理（キーは移行「後」のバージョン） */
const MIGRATIONS: Record<number, Migration> = {
  2: (d) => d, // 不足カテゴリの追加と整形は毎回 normalize で行う
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : v == null ? fallback : String(v));
const int = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : 0;
};

function normalizeCategories(raw: unknown): Category[] {
  const list: Category[] = Array.isArray(raw)
    ? raw.filter(isObj).map((c) => ({
        id: str(c.id) || uid(),
        name: str(c.name, '名称なし'),
        emoji: str(c.emoji, '🔖'),
        color: /^#[0-9a-fA-F]{3,8}$/.test(str(c.color)) ? str(c.color) : '#8a8a99',
        builtIn: Boolean(c.builtIn),
      }))
    : [];
  // 既存データは残したまま、足りない標準カテゴリを追加する（id または名前で一致判定）
  for (const def of DEFAULT_CATEGORIES) {
    const exists = list.find((c) => c.id === def.id || c.name === def.name);
    if (exists) {
      if (exists.id === def.id) exists.builtIn = true;
      continue;
    }
    const before = list.findIndex((c) => c.id === OTHER_ID);
    if (before >= 0 && def.id !== OTHER_ID) list.splice(before, 0, { ...def });
    else list.push({ ...def });
  }
  return list;
}

function normalizeEntries(raw: unknown, categories: Category[]): Entry[] {
  if (!Array.isArray(raw)) return [];
  const catIds = new Set(categories.map((c) => c.id));
  const byName = new Map(categories.map((c) => [c.name, c.id]));
  const fixCat = (v: unknown) => {
    const s = str(v);
    if (catIds.has(s)) return s;
    return byName.get(s) ?? OTHER_ID;
  };
  const now = new Date().toISOString();
  return raw.filter(isObj).map((e) => {
    const items: Item[] = Array.isArray(e.items)
      ? e.items.filter(isObj).map((i) => ({
          id: str(i.id) || uid(),
          name: str(i.name),
          amount: int(i.amount),
          categoryId: fixCat(i.categoryId ?? i.category),
        }))
      : // 旧形式（1件=金額＋カテゴリ）にも対応
        [{ id: uid(), name: str(e.name ?? e.title), amount: int(e.amount), categoryId: fixCat(e.categoryId ?? e.category) }];
    const pm = str(e.paymentMethod) as PaymentMethod;
    const entry: Entry = {
      id: str(e.id) || uid(),
      date: /^\d{4}-\d{2}-\d{2}$/.test(str(e.date)) ? str(e.date) : str(e.date).slice(0, 10) || now.slice(0, 10),
      storeName: str(e.storeName ?? e.store),
      paymentMethod: PAYMENT_METHODS.includes(pm) ? pm : '現金',
      items,
      source: e.source === 'receipt' ? 'receipt' : 'manual',
      createdAt: str(e.createdAt, now),
      updatedAt: str(e.updatedAt, now),
    };
    if (isObj(e.transit)) {
      entry.transit = {
        fromStation: str(e.transit.fromStation),
        toStation: str(e.transit.toStation),
        line: str(e.transit.line),
      };
    }
    if (e.memo) entry.memo = str(e.memo);
    return entry;
  });
}

function normalizeLearned(raw: unknown): Learned {
  const pick = (v: unknown) =>
    isObj(v) ? Object.fromEntries(Object.entries(v).filter(([, c]) => typeof c === 'string')) as Record<string, string> : {};
  return isObj(raw) ? { stores: pick(raw.stores), items: pick(raw.items) } : { stores: {}, items: {} };
}

/** 生データを最新の形式に移行する（純粋関数。既存データは消さない） */
export function migrate(raw: RawData): AppData {
  const categories = normalizeCategories(raw.categories);
  let data: AppData = {
    categories,
    entries: normalizeEntries(raw.entries, categories),
    learned: normalizeLearned(raw.learned),
  };
  for (let v = Math.max(1, raw.schemaVersion) + 1; v <= SCHEMA_VERSION; v++) {
    const m = MIGRATIONS[v];
    if (m) data = m(data);
  }
  return data;
}

function readJSON(storage: Storage, key: string): unknown {
  const s = storage.getItem(key);
  if (s == null) return undefined;
  try {
    return JSON.parse(s);
  } catch {
    // 壊れたデータは消さずに退避しておく
    storage.setItem(`${key}.broken.${Date.now()}`, s);
    return undefined;
  }
}

export function loadData(storage: Storage = localStorage): AppData {
  const version = Number(storage.getItem(KEYS.schemaVersion) ?? (storage.getItem(KEYS.entries) ? 1 : SCHEMA_VERSION));
  const data = migrate({
    entries: readJSON(storage, KEYS.entries),
    categories: readJSON(storage, KEYS.categories),
    learned: readJSON(storage, KEYS.learned),
    schemaVersion: Number.isFinite(version) ? version : 1,
  });
  saveAll(data, storage);
  return data;
}

export function saveAll(data: AppData, storage: Storage = localStorage) {
  storage.setItem(KEYS.entries, JSON.stringify(data.entries));
  storage.setItem(KEYS.categories, JSON.stringify(data.categories));
  storage.setItem(KEYS.learned, JSON.stringify(data.learned));
  storage.setItem(KEYS.schemaVersion, String(SCHEMA_VERSION));
}
