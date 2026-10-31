import { useMemo, useState } from 'react';
import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, type ChartOptions } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { useStore } from '../state/store';
import { daysBetween, monthRange, todayISO, toISODate, yen } from '../lib/format';
import { byCategory, byPayment, filterRange, sumEntries, trend } from '../lib/stats';
import type { Category } from '../types';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip);
ChartJS.defaults.font.family = "'DM Mono', 'Zen Kaku Gothic New', monospace";
ChartJS.defaults.color = '#8a8a99';

type Preset = 'this' | 'last' | 'year' | 'custom';

const MAX_SLICES = 8; // ドーナツに出すカテゴリ数（残りは「ほか」にまとめる）
const SURFACE = '#151518';

export function AnalysisScreen() {
  const { entries, categoryById } = useStore();
  const now = new Date();
  const [preset, setPreset] = useState<Preset>('this');
  const thisMonth = monthRange(now.getFullYear(), now.getMonth());
  const [custom, setCustom] = useState({ start: thisMonth.start, end: todayISO() });

  const { start, end } = useMemo(() => {
    switch (preset) {
      case 'this':
        return thisMonth;
      case 'last':
        return monthRange(now.getFullYear(), now.getMonth() - 1);
      case 'year':
        return { start: toISODate(new Date(now.getFullYear(), 0, 1)), end: toISODate(new Date(now.getFullYear(), 11, 31)) };
      default:
        return custom.start <= custom.end ? custom : { start: custom.end, end: custom.start };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, custom.start, custom.end]);

  const list = useMemo(() => filterRange(entries, start, end), [entries, start, end]);
  const total = sumEntries(list);
  // 1日あたり平均：今日を含む期間は今日までの日数で割る
  const today = todayISO();
  const effectiveEnd = end > today && start <= today ? today : end;
  const days = Math.max(1, daysBetween(start, effectiveEnd) + 1);

  const cats = useMemo(
    () =>
      [...byCategory(list).entries()]
        .filter(([, v]) => v !== 0)
        .map(([id, v]) => ({ cat: categoryById(id), value: v }))
        .sort((a, b) => b.value - a.value),
    [list, categoryById],
  );
  const slices = useMemo(() => {
    if (cats.length <= MAX_SLICES) return cats;
    const head = cats.slice(0, MAX_SLICES - 1);
    const rest = cats.slice(MAX_SLICES - 1).reduce((s, c) => s + c.value, 0);
    const restCat: Category = { id: '__rest', name: 'ほか', emoji: '…', color: '#5a5a66', builtIn: true };
    return [...head, { cat: restCat, value: rest }];
  }, [cats]);
  const payments = [...byPayment(list).entries()].filter(([, v]) => v !== 0).sort((a, b) => b[1] - a[1]);
  const tr = useMemo(() => trend(list, start, end), [list, start, end]);

  const doughnutOptions: ChartOptions<'doughnut'> = {
    cutout: '68%',
    plugins: {
      tooltip: { callbacks: { label: (c) => ` ${c.label}  ${yen(c.parsed)}（${((c.parsed / total) * 100).toFixed(1)}%）` } },
    },
    animation: { duration: 300 },
  };

  const barOptions: ChartOptions<'bar'> = {
    maintainAspectRatio: false,
    plugins: { tooltip: { callbacks: { label: (c) => ` ${yen(c.parsed.y ?? 0)}` } } },
    scales: {
      x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8, font: { size: 10 } } },
      y: {
        beginAtZero: true,
        grid: { color: '#2e2e3866' },
        border: { display: false },
        ticks: { font: { size: 10 }, maxTicksLimit: 5, callback: (v) => (Number(v) >= 10000 ? `${Number(v) / 10000}万` : Number(v).toLocaleString()) },
      },
    },
    animation: { duration: 300 },
  };

  return (
    <div className="screen">
      <div className="chips" role="tablist">
        {(
          [
            ['this', '今月'],
            ['last', '先月'],
            ['year', '今年'],
            ['custom', 'カスタム'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={preset === k} className={`chip ${preset === k ? 'active' : ''}`} onClick={() => setPreset(k)}>
            {label}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="field-grid">
          <label className="field">
            <span>開始日</span>
            <input type="date" value={custom.start} onChange={(e) => e.target.value && setCustom({ ...custom, start: e.target.value })} />
          </label>
          <label className="field">
            <span>終了日</span>
            <input type="date" value={custom.end} onChange={(e) => e.target.value && setCustom({ ...custom, end: e.target.value })} />
          </label>
        </div>
      )}
      <p className="period mono">
        {start.replaceAll('-', '/')} 〜 {end.replaceAll('-', '/')}
      </p>

      <div className="stats">
        <div className="card stat stat-main">
          <span>合計</span>
          <strong className="mono">{yen(total)}</strong>
        </div>
        <div className="card stat">
          <span>1日あたり</span>
          <strong className="mono">{yen(Math.round(total / days))}</strong>
        </div>
        <div className="card stat">
          <span>件数</span>
          <strong className="mono">{list.length}件</strong>
        </div>
      </div>

      <section className="card">
        <h3>カテゴリ別</h3>
        {cats.length === 0 ? (
          <p className="empty">この期間の記録はありません</p>
        ) : (
          <>
            <div className="doughnut-wrap">
              <Doughnut
                data={{
                  labels: slices.map((s) => `${s.cat.emoji} ${s.cat.name}`),
                  datasets: [
                    {
                      data: slices.map((s) => Math.max(0, s.value)),
                      backgroundColor: slices.map((s) => s.cat.color),
                      borderColor: SURFACE,
                      borderWidth: 2,
                      hoverOffset: 6,
                    },
                  ],
                }}
                options={doughnutOptions}
              />
              <div className="doughnut-center">
                <span>合計</span>
                <strong className="mono">{yen(total)}</strong>
              </div>
            </div>
            <ul className="breakdown">
              {cats.map(({ cat, value }) => {
                const pct = total ? (value / total) * 100 : 0;
                return (
                  <li key={cat.id}>
                    <span className="swatch" style={{ background: cat.color }} />
                    <span className="bd-name">
                      {cat.emoji} {cat.name}
                    </span>
                    <span className="bd-pct mono">{pct.toFixed(1)}%</span>
                    <span className="bd-amount mono">{yen(value)}</span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <section className="card">
        <h3>支出の推移（{tr.unit === 'day' ? '日別' : '月別'}）</h3>
        <div className="bar-wrap">
          <Bar
            data={{
              labels: tr.points.map((p) => p.label),
              datasets: [
                {
                  data: tr.points.map((p) => p.value),
                  backgroundColor: '#c8f542',
                  hoverBackgroundColor: '#e0ff7a',
                  borderRadius: 4,
                  borderSkipped: 'bottom',
                  maxBarThickness: 22,
                },
              ],
            }}
            options={barOptions}
          />
        </div>
      </section>

      <section className="card">
        <h3>支払い方法別</h3>
        {payments.length === 0 ? (
          <p className="empty">この期間の記録はありません</p>
        ) : (
          <ul className="pay-list">
            {payments.map(([pm, v]) => (
              <li key={pm}>
                <div className="pay-row">
                  <span>{pm}</span>
                  <span className="mono">
                    {yen(v)} <small className="muted">{total ? ((v / total) * 100).toFixed(1) : 0}%</small>
                  </span>
                </div>
                <div className="meter">
                  <span style={{ width: `${total ? Math.max(0, (v / total) * 100) : 0}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
