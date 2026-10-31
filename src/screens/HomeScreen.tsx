import type { Entry } from '../types';
import { useStore } from '../state/store';
import { EntryList } from '../components/EntryRow';
import { monthRange, yen } from '../lib/format';
import { byCategory, filterRange, sumEntries } from '../lib/stats';

interface Props {
  onCamera: () => void;
  onAlbum: () => void;
  onManual: () => void;
  onText: () => void;
  onClipboard: () => void;
  onOpen: (e: Entry) => void;
  onShowHistory: () => void;
}

export function HomeScreen({ onCamera, onAlbum, onManual, onText, onClipboard, onOpen, onShowHistory }: Props) {
  const { entries, categoryById } = useStore();
  const now = new Date();
  const { start, end } = monthRange(now.getFullYear(), now.getMonth());
  const prev = monthRange(now.getFullYear(), now.getMonth() - 1);
  const month = filterRange(entries, start, end);
  const total = sumEntries(month);
  const prevTotal = sumEntries(filterRange(entries, prev.start, prev.end));
  const cats = [...byCategory(month).entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const recent = [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 8);

  return (
    <div className="screen">
      <section className="card hero">
        <div className="hero-label">{now.getMonth() + 1}月の支出</div>
        <div className="hero-amount mono">{yen(total)}</div>
        <div className="hero-sub">
          <span>{month.length}件</span>
          {prevTotal > 0 && (
            <span className={total > prevTotal ? 'up' : 'down'}>
              先月比 {total >= prevTotal ? '+' : '−'}
              {yen(Math.abs(total - prevTotal))}
            </span>
          )}
        </div>
        {total > 0 && (
          <div className="stack-bar" aria-hidden>
            {cats.map(([id, v]) => (
              <span key={id} style={{ width: `${(v / total) * 100}%`, background: categoryById(id).color }} />
            ))}
          </div>
        )}
      </section>

      <section className="actions">
        <button className="action action-primary" onClick={onCamera}>
          <span className="action-icon">📷</span>
          <span>レシート撮影</span>
        </button>
        <button className="action" onClick={onManual}>
          <span className="action-icon">✍️</span>
          <span>手入力</span>
        </button>
      </section>
      <button className="action-wide" onClick={onClipboard}>
        <span className="action-icon">📋</span>
        <span>
          コピーした文字から読み取る
          <small>ショートカットで読み取った後はここ</small>
        </span>
      </button>
      <div className="sub-actions">
        <button className="link-btn" onClick={onAlbum}>
          🖼 アルバムから選ぶ
        </button>
        <button className="link-btn" onClick={onText}>
          ⌨️ 文字を貼り付けて読み取る
        </button>
      </div>

      <section>
        <div className="section-head">
          <h3>最近の記録</h3>
          {entries.length > recent.length && (
            <button className="link-btn" onClick={onShowHistory}>
              すべて見る ›
            </button>
          )}
        </div>
        <EntryList entries={recent} onOpen={onOpen} empty="まだ記録がありません。レシートを撮影するか手入力してみましょう。" />
      </section>
    </div>
  );
}
