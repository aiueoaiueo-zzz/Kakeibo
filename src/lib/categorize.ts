import type { Category, Entry, Learned } from '../types';
import { ITEM_KEYWORDS, STORE_KEYWORDS } from '../data/categoryRules';
import { OTHER_ID } from '../data/defaultCategories';
import { keyOf } from './text';

function matchRules(name: string, rules: Record<string, string[]>, validIds: Set<string>): string | undefined {
  const k = keyOf(name);
  if (!k) return undefined;
  let best: { id: string; len: number } | undefined;
  for (const [id, words] of Object.entries(rules)) {
    if (!validIds.has(id)) continue;
    for (const w of words) {
      const wk = keyOf(w);
      // 短い英字キーワード（GU, au, JR など）は単語として一致したときだけ
      const hit = /^[a-z]{1,3}$/.test(wk) ? new RegExp(`(^|[^a-z])${wk}([^a-z]|$)`).test(k) : k.includes(wk);
      if (hit && (!best || wk.length > best.len)) best = { id, len: wk.length };
    }
  }
  return best?.id;
}

export interface CategorizeInput {
  itemName: string;
  storeName?: string;
}

/**
 * 商品のカテゴリを判定する。
 * 1. 学習（商品名 → 店名） 2. 商品名キーワード辞書 3. 店名辞書 4. その他
 */
export function categorize({ itemName, storeName = '' }: CategorizeInput, learned: Learned, categories: Category[]): string {
  const ids = new Set(categories.map((c) => c.id));
  const valid = (id: string | undefined) => (id && ids.has(id) ? id : undefined);
  const ik = keyOf(itemName);
  const sk = keyOf(storeName);
  return (
    (ik && valid(learned.items[ik])) ||
    (sk && valid(learned.stores[sk])) ||
    matchRules(itemName, ITEM_KEYWORDS, ids) ||
    matchRules(storeName, STORE_KEYWORDS, ids) ||
    (ids.has(OTHER_ID) ? OTHER_ID : categories[0]?.id ?? OTHER_ID)
  );
}

/** 保存したエントリから「店名→カテゴリ」「商品名→カテゴリ」を学習する */
export function learnFromEntry(learned: Learned, entry: Entry): Learned {
  const next: Learned = { stores: { ...learned.stores }, items: { ...learned.items } };
  for (const it of entry.items) {
    const k = keyOf(it.name);
    if (k) next.items[k] = it.categoryId;
  }
  const sk = keyOf(entry.storeName);
  if (sk && entry.items.length) {
    // 店のカテゴリは、金額が一番大きいカテゴリ
    const sums = new Map<string, number>();
    for (const it of entry.items) sums.set(it.categoryId, (sums.get(it.categoryId) ?? 0) + Math.abs(it.amount));
    next.stores[sk] = [...sums.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }
  return next;
}
