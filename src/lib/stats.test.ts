import { describe, expect, it } from 'vitest';
import type { Entry } from '../types';
import { byCategory, byDay, byPayment, filterRange, sumEntries, trend } from './stats';

const mk = (id: string, date: string, pm: Entry['paymentMethod'], items: [string, number][]): Entry => ({
  id,
  date,
  storeName: id,
  paymentMethod: pm,
  items: items.map(([categoryId, amount], i) => ({ id: `${id}-${i}`, name: 'x', amount, categoryId })),
  source: 'manual',
  createdAt: '',
  updatedAt: '',
});

const entries = [
  mk('a', '2026-10-01', '現金', [['food', 300], ['daily', 200]]),
  mk('b', '2026-10-15', 'クレカ', [['food', 1000]]),
  mk('c', '2026-10-15', '電子マネー', [['transport', 170]]),
  mk('d', '2026-09-30', '現金', [['food', 999]]),
];

describe('集計の整合性', () => {
  const oct = filterRange(entries, '2026-10-01', '2026-10-31');
  const total = sumEntries(oct);

  it('期間で絞り込める', () => expect(oct.map((e) => e.id)).toEqual(['a', 'b', 'c']));
  it('合計', () => expect(total).toBe(1670));
  it('カテゴリ別（商品単位）の合計 = 全体合計', () => {
    const c = byCategory(oct);
    expect(c.get('food')).toBe(1300);
    expect([...c.values()].reduce((a, b) => a + b, 0)).toBe(total);
  });
  it('支払い方法別の合計 = 全体合計', () => {
    expect([...byPayment(oct).values()].reduce((a, b) => a + b, 0)).toBe(total);
  });
  it('日別（カレンダー）の合計 = 全体合計', () => {
    const d = byDay(oct);
    expect(d.get('2026-10-15')).toBe(1170);
    expect([...d.values()].reduce((a, b) => a + b, 0)).toBe(total);
  });
  it('推移：1か月なら日別', () => {
    const t = trend(oct, '2026-10-01', '2026-10-31');
    expect(t.unit).toBe('day');
    expect(t.points).toHaveLength(31);
    expect(t.points.reduce((s, p) => s + p.value, 0)).toBe(total);
  });
  it('推移：1年なら月別', () => {
    const t = trend(entries, '2026-01-01', '2026-12-31');
    expect(t.unit).toBe('month');
    expect(t.points).toHaveLength(12);
    expect(t.points[8].value).toBe(999);
    expect(t.points[9].value).toBe(1670);
  });
});
