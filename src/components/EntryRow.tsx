import type { Entry } from '../types';
import { useStore } from '../state/store';
import { entryTitle, entryTotal, formatDateJP, yen } from '../lib/format';

export function EntryRow({ entry, onClick, showDate = true }: { entry: Entry; onClick: () => void; showDate?: boolean }) {
  const { categoryById } = useStore();
  const cats = [...new Set(entry.items.map((i) => i.categoryId))].map(categoryById);
  const main = cats[0];
  return (
    <button className="entry-row" onClick={onClick}>
      <span className="entry-emoji" style={{ background: `${main?.color ?? '#8a8a99'}22`, borderColor: `${main?.color ?? '#8a8a99'}55` }}>
        {main?.emoji ?? '🔖'}
      </span>
      <span className="entry-main">
        <span className="entry-title">{entryTitle(entry)}</span>
        <span className="entry-sub">
          {showDate && <span>{formatDateJP(entry.date)}</span>}
          <span className="pill">{entry.paymentMethod}</span>
          {cats.length > 1 && <span className="entry-cats">{cats.slice(1, 4).map((c) => c.emoji).join('')}</span>}
          {entry.source === 'receipt' && <span title="レシート読取">🧾</span>}
        </span>
      </span>
      <span className="entry-amount mono">{yen(entryTotal(entry))}</span>
    </button>
  );
}

export function EntryList({ entries, onOpen, showDate = true, empty = '記録がありません' }: {
  entries: Entry[];
  onOpen: (e: Entry) => void;
  showDate?: boolean;
  empty?: string;
}) {
  if (!entries.length) return <p className="empty">{empty}</p>;
  return (
    <div className="entry-list">
      {entries.map((e) => (
        <EntryRow key={e.id} entry={e} onClick={() => onOpen(e)} showDate={showDate} />
      ))}
    </div>
  );
}
