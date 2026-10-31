import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { monthRange, todayISO, toISODate, yen } from '../lib/format';
import { byDay, filterRange, sumEntries } from '../lib/stats';

const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

const short = (n: number) => (n >= 100000 ? `${Math.round(n / 1000)}k` : n >= 10000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString('ja-JP'));

export function CalendarScreen({ onSelectDay }: { onSelectDay: (date: string) => void }) {
  const { entries } = useStore();
  const [ym, setYm] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const today = todayISO();
  const { start, end } = monthRange(ym.y, ym.m);
  const monthEntries = useMemo(() => filterRange(entries, start, end), [entries, start, end]);
  const days = useMemo(() => byDay(monthEntries), [monthEntries]);
  const max = Math.max(0, ...days.values());
  const total = sumEntries(monthEntries);

  const first = new Date(ym.y, ym.m, 1);
  const cells: (string | null)[] = Array(first.getDay()).fill(null);
  const last = new Date(ym.y, ym.m + 1, 0).getDate();
  for (let d = 1; d <= last; d++) cells.push(toISODate(new Date(ym.y, ym.m, d)));
  while (cells.length % 7) cells.push(null);

  const move = (diff: number) =>
    setYm(({ y, m }) => {
      const d = new Date(y, m + diff, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  return (
    <div className="screen">
      <div className="cal-nav">
        <button className="icon-btn" onClick={() => move(-1)} aria-label="前の月">
          ‹
        </button>
        <button
          className="cal-title"
          onClick={() => {
            const d = new Date();
            setYm({ y: d.getFullYear(), m: d.getMonth() });
          }}
        >
          {ym.y}年{ym.m + 1}月
        </button>
        <button className="icon-btn" onClick={() => move(1)} aria-label="次の月">
          ›
        </button>
      </div>
      <div className="cal-summary">
        <span>月の合計</span>
        <span className="mono">{yen(total)}</span>
      </div>
      <div className="cal-grid">
        {WEEK.map((w, i) => (
          <div key={w} className={`cal-week ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}`}>
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} className="cal-cell empty" />;
          const v = days.get(d) ?? 0;
          const ratio = max ? v / max : 0;
          const alpha = v ? 0.12 + ratio * 0.6 : 0;
          return (
            <button
              key={d}
              className={`cal-cell ${d === today ? 'today' : ''} ${i % 7 === 0 ? 'sun' : i % 7 === 6 ? 'sat' : ''} ${ratio > 0.55 ? 'strong' : ''}`}
              style={v ? { background: `rgba(200, 245, 66, ${alpha.toFixed(3)})` } : undefined}
              onClick={() => onSelectDay(d)}
            >
              <span className="cal-day">{+d.slice(8)}</span>
              {v > 0 && <span className="cal-amount mono">{short(v)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
