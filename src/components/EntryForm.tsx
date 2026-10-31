import { useMemo, useRef, useState } from 'react';
import type { Entry, Item, PaymentMethod, Transit } from '../types';
import { PAYMENT_METHODS } from '../types';
import { useStore } from '../state/store';
import { useToast } from '../state/toast';
import { categorize } from '../lib/categorize';
import { todayISO, yen } from '../lib/format';
import { uid } from '../lib/id';
import type { ParsedReceipt } from '../lib/parseReceipt';
import { TRANSPORT_ID } from '../data/defaultCategories';

/** 入力フォームの初期値 */
export interface FormInit {
  entry?: Entry; // 編集
  date?: string; // 新規で日付を指定（カレンダーから）
  parsed?: { receipt: ParsedReceipt; rawText: string; source: 'receipt' | 'text' };
  emptyRow?: boolean; // 読取失敗時など、空の商品行1行で始める
  ocrError?: string;
}

interface Row {
  id: string;
  name: string;
  amount: string;
  categoryId: string;
  catTouched: boolean; // ユーザーがカテゴリを手で選んだ
}

const toRow = (i: Item, touched = true): Row => ({
  id: i.id,
  name: i.name,
  amount: String(i.amount),
  categoryId: i.categoryId,
  catTouched: touched,
});

const parseAmount = (s: string) => {
  const n = Number(s.normalize('NFKC').replace(/[^\d-]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : 0;
};

interface Props {
  init: FormInit;
  onDone: () => void;
}

export function EntryForm({ init, onDone }: Props) {
  const { categories, learned, saveEntry, deleteEntry } = useStore();
  const toast = useToast();
  const editing = init.entry;
  const parsed = init.parsed?.receipt;

  const autoCat = (itemName: string, storeName: string) => categorize({ itemName, storeName }, learned, categories);

  const [date, setDate] = useState(() => editing?.date ?? parsed?.date ?? init.date ?? todayISO());
  const [payment, setPayment] = useState<PaymentMethod>(editing?.paymentMethod ?? parsed?.paymentMethod ?? '現金');
  const [storeName, setStoreName] = useState(editing?.storeName ?? parsed?.storeName ?? '');
  const [transit, setTransit] = useState<Transit>(
    editing?.transit ?? parsed?.transit ?? { fromStation: '', toStation: '', line: '' },
  );
  const [memo, setMemo] = useState(editing?.memo ?? '');
  const [rows, setRows] = useState<Row[]>(() => {
    if (editing) return editing.items.map((i) => toRow(i));
    if (parsed && parsed.items.length) {
      return parsed.items.map((i) => ({
        id: uid(),
        name: i.name,
        amount: String(i.amount),
        categoryId: parsed.isTransit ? TRANSPORT_ID : autoCat(i.name, parsed.storeName),
        catTouched: parsed.isTransit,
      }));
    }
    const base = parsed?.isTransit ? TRANSPORT_ID : autoCat('', parsed?.storeName ?? '');
    return [{ id: uid(), name: parsed?.isTransit ? '運賃' : '', amount: '', categoryId: base, catTouched: Boolean(parsed?.isTransit) }];
  });
  const lastAmountRef = useRef<HTMLInputElement | null>(null);

  const transitMode = rows.some((r) => r.categoryId === TRANSPORT_ID);
  const total = useMemo(() => rows.reduce((s, r) => s + parseAmount(r.amount), 0), [rows]);
  const receiptTotal = editing ? null : parsed?.total ?? null;

  const updateRow = (id: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const onNameChange = (row: Row, name: string) => {
    updateRow(row.id, row.catTouched ? { name } : { name, categoryId: autoCat(name, storeName) });
  };

  const onStoreChange = (name: string) => {
    setStoreName(name);
    setRows((rs) => rs.map((r) => (r.catTouched ? r : { ...r, categoryId: autoCat(r.name, name) })));
  };

  const addRow = () => {
    const cat = transitMode ? TRANSPORT_ID : autoCat('', storeName);
    setRows((rs) => [...rs, { id: uid(), name: '', amount: '', categoryId: cat, catTouched: transitMode }]);
    setTimeout(() => lastAmountRef.current?.closest('.item-row')?.querySelector('input')?.focus(), 30);
  };

  const removeRow = (id: string) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : rs));

  const save = () => {
    const items: Item[] = rows
      .filter((r) => r.name.trim() || parseAmount(r.amount) !== 0)
      .map((r) => ({
        id: r.id,
        name: r.name.trim() || (r.categoryId === TRANSPORT_ID ? '運賃' : ''),
        amount: parseAmount(r.amount),
        categoryId: r.categoryId,
      }));
    if (!items.length) {
      toast('error', '金額を入力してください');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      toast('error', '日付を入力してください');
      return;
    }
    const now = new Date().toISOString();
    const isTransit = items.some((i) => i.categoryId === TRANSPORT_ID);
    const t: Transit = { fromStation: transit.fromStation.trim(), toStation: transit.toStation.trim(), line: transit.line.trim() };
    const entry: Entry = {
      id: editing?.id ?? uid(),
      date,
      storeName: isTransit ? '' : storeName.trim(),
      paymentMethod: payment,
      items,
      source: editing?.source ?? (parsed ? 'receipt' : 'manual'),
      createdAt: editing?.createdAt ?? now,
      updatedAt: now,
    };
    if (isTransit && (t.fromStation || t.toStation || t.line)) entry.transit = t;
    if (memo.trim()) entry.memo = memo.trim();
    saveEntry(entry);
    toast('success', editing ? '更新しました' : '保存しました');
    onDone();
  };

  const remove = () => {
    if (!editing) return;
    if (!window.confirm('この記録を削除しますか？')) return;
    deleteEntry(editing.id);
    toast('success', '削除しました');
    onDone();
  };

  return (
    <div className="form">
      {init.ocrError && <div className="notice notice-error">⚠ {init.ocrError}<br />手入力で続けてください。</div>}
      {parsed && !parsed.dateFound && <div className="notice">日付を読み取れなかったので今日の日付にしています</div>}

      <div className="field-grid">
        <label className="field">
          <span>日付</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label className="field">
          <span>支払い方法</span>
          <select value={payment} onChange={(e) => setPayment(e.target.value as PaymentMethod)}>
            {PAYMENT_METHODS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
      </div>

      {transitMode ? (
        <div className="transit-box">
          <div className="field-grid">
            <label className="field">
              <span>🚉 乗車駅</span>
              <input value={transit.fromStation} onChange={(e) => setTransit({ ...transit, fromStation: e.target.value })} placeholder="渋谷" />
            </label>
            <label className="field">
              <span>🚉 降車駅</span>
              <input value={transit.toStation} onChange={(e) => setTransit({ ...transit, toStation: e.target.value })} placeholder="新宿" />
            </label>
          </div>
          <label className="field">
            <span>交通機関</span>
            <input value={transit.line} onChange={(e) => setTransit({ ...transit, line: e.target.value })} placeholder="JR山手線" />
          </label>
        </div>
      ) : (
        <label className="field">
          <span>お店の名前</span>
          <input value={storeName} onChange={(e) => onStoreChange(e.target.value)} placeholder="例：セブンイレブン" autoComplete="off" />
        </label>
      )}

      <div className="items-head">
        <span>{transitMode ? '運賃' : '商品'}</span>
        <span className="mono muted">{rows.length}件</span>
      </div>
      <div className="items">
        {rows.map((r, idx) => (
          <div className="item-row" key={r.id}>
            <input
              className="item-name"
              value={r.name}
              onChange={(e) => onNameChange(r, e.target.value)}
              placeholder={r.categoryId === TRANSPORT_ID ? '運賃' : '商品名'}
              aria-label="商品名"
            />
            <div className="item-amount">
              <span className="mono">¥</span>
              <input
                ref={idx === rows.length - 1 ? lastAmountRef : undefined}
                className="mono"
                inputMode="numeric"
                value={r.amount}
                onChange={(e) => updateRow(r.id, { amount: e.target.value.replace(/[^\d０-９-]/g, '') })}
                placeholder="0"
                aria-label="金額"
              />
            </div>
            <select
              className="item-cat"
              value={r.categoryId}
              onChange={(e) => updateRow(r.id, { categoryId: e.target.value, catTouched: true })}
              aria-label="カテゴリ"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </select>
            <button className="icon-btn danger-text" onClick={() => removeRow(r.id)} disabled={rows.length <= 1} aria-label="行を削除">
              −
            </button>
          </div>
        ))}
      </div>
      <button className="btn btn-ghost btn-block" onClick={addRow}>
        ＋ 行を追加
      </button>

      <div className="total-bar">
        <span>合計</span>
        <span className="mono total-amount">{yen(total)}</span>
      </div>
      {receiptTotal != null && receiptTotal !== total && (
        <div className="notice notice-warn">
          ⚠ 合計が一致しません（レシート：{yen(receiptTotal)}／入力：{yen(total)}）
        </div>
      )}

      <label className="field">
        <span>メモ</span>
        <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={2} placeholder="任意" />
      </label>

      {init.parsed && (
        <details className="raw-text">
          <summary>{init.parsed.source === 'receipt' ? '読み取った文字を見る' : '貼り付けた文字を見る'}</summary>
          <pre>{init.parsed.rawText || '（文字が読み取れませんでした）'}</pre>
        </details>
      )}

      <div className="form-actions">
        {editing && (
          <button className="btn btn-danger" onClick={remove}>
            削除
          </button>
        )}
        <button className="btn btn-primary btn-grow" onClick={save}>
          {editing ? '更新する' : '保存する'}
        </button>
      </div>
    </div>
  );
}
