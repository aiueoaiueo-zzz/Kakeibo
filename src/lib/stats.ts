import type { Entry, PaymentMethod } from '../types';
import { addDays, daysBetween, entryTotal } from './format';

export const inRange = (e: Entry, start: string, end: string) => e.date >= start && e.date <= end;

export function filterRange(entries: Entry[], start: string, end: string): Entry[] {
  return entries.filter((e) => inRange(e, start, end));
}

export const sumEntries = (entries: Entry[]) => entries.reduce((s, e) => s + entryTotal(e), 0);

/** カテゴリ別合計（商品単位） */
export function byCategory(entries: Entry[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of entries) for (const i of e.items) m.set(i.categoryId, (m.get(i.categoryId) ?? 0) + i.amount);
  return m;
}

export function byPayment(entries: Entry[]): Map<PaymentMethod, number> {
  const m = new Map<PaymentMethod, number>();
  for (const e of entries) m.set(e.paymentMethod, (m.get(e.paymentMethod) ?? 0) + entryTotal(e));
  return m;
}

/** 日付ごとの合計 */
export function byDay(entries: Entry[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of entries) m.set(e.date, (m.get(e.date) ?? 0) + entryTotal(e));
  return m;
}

export interface TrendPoint {
  label: string;
  key: string;
  value: number;
}

/** 推移：62日以内なら日別、それより長ければ月別 */
export function trend(entries: Entry[], start: string, end: string): { unit: 'day' | 'month'; points: TrendPoint[] } {
  const days = daysBetween(start, end) + 1;
  if (days <= 62) {
    const d = byDay(entries);
    const points: TrendPoint[] = [];
    for (let i = 0; i < days; i++) {
      const key = addDays(start, i);
      points.push({ key, label: `${+key.slice(5, 7)}/${+key.slice(8)}`, value: d.get(key) ?? 0 });
    }
    return { unit: 'day', points };
  }
  const m = new Map<string, number>();
  for (const e of entries) m.set(e.date.slice(0, 7), (m.get(e.date.slice(0, 7)) ?? 0) + entryTotal(e));
  const points: TrendPoint[] = [];
  let y = +start.slice(0, 4);
  let mo = +start.slice(5, 7);
  const endKey = end.slice(0, 7);
  for (let guard = 0; guard < 600; guard++) {
    const key = `${y}-${String(mo).padStart(2, '0')}`;
    points.push({ key, label: `${y % 100}/${mo}`, value: m.get(key) ?? 0 });
    if (key >= endKey) break;
    mo++;
    if (mo > 12) {
      mo = 1;
      y++;
    }
  }
  return { unit: 'month', points };
}
