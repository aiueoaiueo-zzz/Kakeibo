import { useRef, useState } from 'react';
import type { Category } from '../types';
import { useStore } from '../state/store';
import { useToast } from '../state/toast';
import { BottomSheet } from '../components/BottomSheet';
import { download, toCSV, toJSON } from '../lib/exportData';
import { todayISO } from '../lib/format';
import { uid } from '../lib/id';
import { prepareOcr } from '../lib/ocr';
import { OTHER_ID } from '../data/defaultCategories';

const PRESET_COLORS = ['#c8f542', '#2fd0a0', '#4278f5', '#f5a842', '#a842f5', '#f542a8', '#f5e642', '#f54242', '#42c8f5', '#e8e0d0', '#ff6b35', '#8a8a99'];

function CategoryEditor({ initial, onSave, onDelete }: { initial: Category; onSave: (c: Category) => void; onDelete?: () => void }) {
  const [c, setC] = useState(initial);
  return (
    <div className="form">
      <div className="field-grid cat-edit-top">
        <label className="field emoji-field">
          <span>絵文字</span>
          <input value={c.emoji} onChange={(e) => setC({ ...c, emoji: e.target.value })} maxLength={4} />
        </label>
        <label className="field">
          <span>名前</span>
          <input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} placeholder="カテゴリ名" />
        </label>
      </div>
      <div className="field">
        <span>色</span>
        <div className="color-row">
          {PRESET_COLORS.map((col) => (
            <button
              key={col}
              className={`color-dot ${c.color.toLowerCase() === col ? 'active' : ''}`}
              style={{ background: col }}
              onClick={() => setC({ ...c, color: col })}
              aria-label={col}
            />
          ))}
          <input type="color" value={c.color} onChange={(e) => setC({ ...c, color: e.target.value })} aria-label="色を選ぶ" />
        </div>
      </div>
      <div className="form-actions">
        {onDelete && (
          <button className="btn btn-danger" onClick={onDelete}>
            削除
          </button>
        )}
        <button className="btn btn-primary btn-grow" disabled={!c.name.trim()} onClick={() => onSave({ ...c, name: c.name.trim(), emoji: c.emoji.trim() || '🔖' })}>
          保存する
        </button>
      </div>
    </div>
  );
}

export function SettingsScreen() {
  const store = useStore();
  const { categories, entries, learned } = store;
  const toast = useToast();
  const [editing, setEditing] = useState<Category | null>(null);
  const [ocrState, setOcrState] = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);

  const usage = (id: string) => entries.reduce((n, e) => n + e.items.filter((i) => i.categoryId === id).length, 0);

  const move = (idx: number, diff: number) => {
    const next = [...categories];
    const j = idx + diff;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    store.setCategories(next);
  };

  const saveCategory = (c: Category) => {
    const exists = categories.some((x) => x.id === c.id);
    if (categories.some((x) => x.id !== c.id && x.name === c.name)) {
      toast('error', '同じ名前のカテゴリがあります');
      return;
    }
    if (exists) store.setCategories(categories.map((x) => (x.id === c.id ? c : x)));
    else {
      const next = [...categories];
      const otherIdx = next.findIndex((x) => x.id === OTHER_ID);
      next.splice(otherIdx >= 0 ? otherIdx : next.length, 0, c);
      store.setCategories(next);
    }
    toast('success', exists ? 'カテゴリを更新しました' : 'カテゴリを追加しました');
    setEditing(null);
  };

  const deleteCategory = (c: Category) => {
    const n = usage(c.id);
    const msg = n ? `「${c.name}」は${n}件の商品で使われています。削除して「その他」に移しますか？` : `「${c.name}」を削除しますか？`;
    if (!window.confirm(msg)) return;
    store.deleteCategory(c.id);
    toast('success', '削除しました');
    setEditing(null);
  };

  const onImport = async (file: File) => {
    try {
      const raw = JSON.parse(await file.text());
      if (!raw || !Array.isArray(raw.entries)) throw new Error('かけいぼのJSONではありません');
      if (!window.confirm(`${raw.entries.length}件の記録を読み込みます。同じIDの記録は上書きされます。よろしいですか？`)) return;
      const r = store.importData(raw);
      toast('success', `${r.entries}件を読み込みました`);
    } catch (e) {
      toast('error', `読み込めませんでした：${(e as Error).message}`);
    }
  };

  const clearAll = () => {
    if (!window.confirm('すべての記録・カテゴリ・学習データを削除します。よろしいですか？')) return;
    if (!window.confirm('本当に削除しますか？この操作は取り消せません。（先にエクスポートでバックアップを取ることをおすすめします）')) return;
    store.clearAll();
    toast('success', 'すべてのデータを削除しました');
  };

  const prepare = async () => {
    try {
      setOcrState('準備中… 0%');
      await prepareOcr((p) => setOcrState(`${p.status}… ${Math.round(p.progress * 100)}%`));
      setOcrState('準備完了（オフラインでも読取できます）');
      toast('success', 'OCRデータを読み込みました');
    } catch (e) {
      setOcrState('');
      toast('error', (e as Error).message);
    }
  };

  return (
    <div className="screen">
      <section className="card">
        <div className="section-head">
          <h3>カテゴリ</h3>
          <button
            className="btn btn-small"
            onClick={() => setEditing({ id: uid(), name: '', emoji: '🔖', color: PRESET_COLORS[categories.length % PRESET_COLORS.length], builtIn: false })}
          >
            ＋ 追加
          </button>
        </div>
        <ul className="cat-list">
          {categories.map((c, i) => (
            <li key={c.id}>
              <button className="cat-main" onClick={() => setEditing(c)}>
                <span className="swatch" style={{ background: c.color }} />
                <span className="cat-emoji">{c.emoji}</span>
                <span className="cat-name">{c.name}</span>
                {c.builtIn && <span className="pill">標準</span>}
                <span className="muted mono small">{usage(c.id)}</span>
              </button>
              <button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="上へ">
                ↑
              </button>
              <button className="icon-btn" onClick={() => move(i, 1)} disabled={i === categories.length - 1} aria-label="下へ">
                ↓
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h3>データ</h3>
        <p className="hint">
          記録 {entries.length}件・学習済み 店名{Object.keys(learned.stores).length}／商品{Object.keys(learned.items).length}
          <br />
          データはこの端末のブラウザ内にだけ保存されています。機種変更の前などにエクスポートしてください。
        </p>
        <div className="btn-col">
          <button className="btn" onClick={() => download(`kakeibo-${todayISO()}.json`, toJSON(entries, categories, learned), 'application/json')}>
            ⬇ JSONでエクスポート（バックアップ）
          </button>
          <button className="btn" onClick={() => download(`kakeibo-${todayISO()}.csv`, toCSV(entries, categories), 'text/csv')}>
            ⬇ CSVでエクスポート（表計算用）
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            ⬆ JSONからインポート
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) onImport(f);
            }}
          />
        </div>
      </section>

      <section className="card">
        <h3>ショートカット連携（おすすめ・高精度）</h3>
        <p className="hint">iPhone標準の文字認識（テキスト認識表示）で読み取ります。端末の中だけで動くので無料・通信なしで、アプリ内のOCRより正確です。</p>
        <details>
          <summary className="link-btn">作り方を見る</summary>
          <ol className="steps">
            <li>「ショートカット」アプリを開き、右上の <b>＋</b> で新規作成</li>
            <li>
              アクションを検索して、次の順に追加
              <br />① <b>写真を撮る</b>（「カメラのプレビューを表示」はオン）
              <br />② <b>画像からテキストを抽出</b>
              <br />③ <b>クリップボードにコピー</b>
              <br />④（任意）<b>通知を表示</b>：「かけいぼを開いて📋を押してください」
            </li>
            <li>名前を「レシート読取」などにして完了。共有ボタン →「ホーム画面に追加」すると1タップで起動できる（アクションボタンや背面タップにも割り当て可）</li>
            <li>使うとき：ショートカットで撮影 → かけいぼを開く → ホームの <b>📋 コピーした文字から読み取る</b> → 「ペースト」を押す → 内容を確認して保存</li>
          </ol>
          <p className="hint">アルバムの写真から読みたいときは、①を「写真を選択」にしたショートカットをもう1つ作るか、写真アプリでテキスト認識 →「すべてを選択」→コピーしてください。</p>
        </details>
      </section>

      <section className="card">
        <h3>レシート読取（OCR）</h3>
        <p className="hint">読取は端末の中だけで行います。日本語データ（約2MB）を先に読み込んでおくと、電波がない場所でも読取できます。</p>
        <button className="btn" onClick={prepare} disabled={ocrState.includes('%')}>
          OCRデータを読み込む
        </button>
        {ocrState && <p className="hint mono">{ocrState}</p>}
      </section>

      <section className="card danger-zone">
        <h3>全データ削除</h3>
        <button className="btn btn-danger" onClick={clearAll}>
          すべてのデータを削除
        </button>
      </section>

      <p className="footer-note">かけいぼ v{__APP_VERSION__}</p>

      <BottomSheet open={editing != null} title={editing && categories.some((c) => c.id === editing.id) ? 'カテゴリを編集' : 'カテゴリを追加'} onClose={() => setEditing(null)}>
        {editing && (
          <CategoryEditor
            key={editing.id}
            initial={editing}
            onSave={saveCategory}
            onDelete={categories.some((c) => c.id === editing.id) && !editing.builtIn ? () => deleteCategory(editing) : undefined}
          />
        )}
      </BottomSheet>
    </div>
  );
}
