import type { Entry } from '../types';

export const yen = (n: number) => `¥${Math.round(n).toLocaleString('ja-JP')}`;

export const entryTotal = (e: Entry) => e.items.reduce((s, i) => s + (Number.isFinite(i.amount) ? i.amount : 0), 0);

/** 履歴などに出すタイトル：店名、または「渋谷 → 新宿（JR山手線）」 */
export function entryTitle(e: Entry): string {
  const t = e.transit;
  if (t && (t.fromStation || t.toStation)) {
    return `${t.fromStation || '?'} → ${t.toStation || '?'}${t.line ? `（${t.line}）` : ''}`;
  }
  return e.storeName || (t?.line ?? '') || '（店名なし）';
}

const pad = (n: number) => String(n).padStart(2, '0');

/** ローカル時刻の YYYY-MM-DD */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const todayISO = () => toISODate(new Date());

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseISODate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86400000);
}

const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
export function formatDateJP(s: string, withYear = false): string {
  const d = parseISODate(s);
  const md = `${d.getMonth() + 1}/${d.getDate()}（${WEEK[d.getDay()]}）`;
  return withYear ? `${d.getFullYear()}/${md}` : md;
}

export function monthRange(year: number, month0: number): { start: string; end: string } {
  return { start: toISODate(new Date(year, month0, 1)), end: toISODate(new Date(year, month0 + 1, 0)) };
}
