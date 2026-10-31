import { useMemo, useState } from 'react';
import type { Entry, PaymentMethod } from '../types';
import { PAYMENT_METHODS } from '../types';
import { useStore } from '../state/store';
import { EntryRow } from '../components/EntryRow';
import { entryTitle, entryTotal, formatDateJP, yen } from '../lib/format';
import { keyOf } from '../lib/text';

export function HistoryScreen({ onOpen }: { onOpen: (e: Entry) => void }) {
  const { entries, categories } = useStore();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [pm, setPm] = useState<PaymentMethod | ''>('');

  const filtered = useMemo(() => {
    const k = keyOf(q);
    return entries
      .filter((e) => {
        if (cat && !e.items.some((i) => i.categoryId === cat)) return false;
        if (pm && e.paymentMethod !== pm) return false;
        if (k) {
          const hay = keyOf([e.storeName, entryTitle(e), e.memo ?? '', ...e.items.map((i) => i.name)].join(' '));
          if (!hay.includes(k)) return false;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [entries, q, cat, pm]);

  const groups = useMemo(() => {
    const m = new Map<string, Entry[]>();
    for (const e of filtered) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return [...m.entries()];
  }, [filtered]);
  const total = filtered.reduce((s, e) => s + entryTotal(e), 0);

  return (
    <div className="screen">
      <div className="filters">
        <input className="search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 店名・商品名・メモで検索" />
        <div className="field-grid">
          <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="カテゴリで絞り込み">
            <option value="">すべてのカテゴリ</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
          <select value={pm} onChange={(e) => setPm(e.target.value as PaymentMethod | '')} aria-label="支払い方法で絞り込み">
            <option value="">すべての支払い方法</option>
            {PAYMENT_METHODS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="result-summary">
        <span>{filtered.length}件</span>
        <span className="mono">{yen(total)}</span>
      </div>
      {groups.length === 0 && <p className="empty">該当する記録はありません</p>}
      {groups.map(([date, list]) => (
        <section key={date} className="day-group">
          <div className="day-head">
            <span>{formatDateJP(date, true)}</span>
            <span className="mono">{yen(list.reduce((s, e) => s + entryTotal(e), 0))}</span>
          </div>
          <div className="entry-list">
            {list.map((e) => (
              <EntryRow key={e.id} entry={e} onClick={() => onOpen(e)} showDate={false} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
