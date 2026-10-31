import type { Category, Entry, Learned } from '../types';
import { SCHEMA_VERSION } from './storage';
import { entryTitle } from './format';

export function toJSON(entries: Entry[], categories: Category[], learned: Learned): string {
  return JSON.stringify({ app: 'kakeibo', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), entries, categories, learned }, null, 2);
}

const esc = (v: string | number) => {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** 商品1行=CSV1行 */
export function toCSV(entries: Entry[], categories: Category[]): string {
  const cat = new Map(categories.map((c) => [c.id, c.name]));
  const rows: (string | number)[][] = [['日付', '店名・区間', '支払い方法', '商品名', '金額', 'カテゴリ', 'メモ', '入力方法', 'ID']];
  for (const e of [...entries].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const i of e.items) {
      rows.push([e.date, entryTitle(e), e.paymentMethod, i.name, i.amount, cat.get(i.categoryId) ?? 'その他', e.memo ?? '', e.source === 'receipt' ? 'レシート' : '手入力', e.id]);
    }
  }
  // Excel で文字化けしないよう BOM を付ける
  return '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n');
}

export function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
