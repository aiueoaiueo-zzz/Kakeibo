import { useCallback, useRef, useState } from 'react';
import type { Entry, Tab } from './types';
import { useStore } from './state/store';
import { useToast } from './state/toast';
import { BottomSheet } from './components/BottomSheet';
import { EntryForm, type FormInit } from './components/EntryForm';
import { EntryList } from './components/EntryRow';
import { ScanSheet } from './components/ScanSheet';
import { TextImport } from './components/TextImport';
import { CalendarIcon, ChartIcon, GearIcon, HomeIcon, ListIcon } from './components/Icons';
import { HomeScreen } from './screens/HomeScreen';
import { CalendarScreen } from './screens/CalendarScreen';
import { AnalysisScreen } from './screens/AnalysisScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { parseReceipt } from './lib/parseReceipt';
import { entryTotal, formatDateJP, yen } from './lib/format';

type Sheet =
  | { kind: 'form'; init: FormInit; key: number; returnDay?: string }
  | { kind: 'scan'; file: File }
  | { kind: 'text' }
  | { kind: 'day'; date: string }
  | null;

const TABS: { id: Tab; label: string; title: string; Icon: () => React.JSX.Element }[] = [
  { id: 'home', label: 'ホーム', title: 'かけいぼ', Icon: HomeIcon },
  { id: 'calendar', label: 'カレンダー', title: 'カレンダー', Icon: CalendarIcon },
  { id: 'analysis', label: '分析', title: '分析', Icon: ChartIcon },
  { id: 'history', label: '履歴', title: '履歴', Icon: ListIcon },
  { id: 'settings', label: '設定', title: '設定', Icon: GearIcon },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [sheet, setSheet] = useState<Sheet>(null);
  const formSeq = useRef(0);
  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const { entries } = useStore();
  const toast = useToast();

  const openForm = useCallback((init: FormInit, returnDay?: string) => {
    setSheet({ kind: 'form', init, key: ++formSeq.current, returnDay });
  }, []);
  const closeSheet = useCallback(() => {
    setSheet((s) => (s?.kind === 'form' && s.returnDay ? { kind: 'day', date: s.returnDay } : null));
  }, []);

  // 「写真を使用」を押した直後に確実に読み取りへ進む：input はアプリ直下に常に置き、
  // 選択されたファイルを取り出してから value をリセットする（同じ写真の再選択にも対応）
  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    setSheet({ kind: 'scan', file });
  };

  const onScanResult = useCallback(
    (rawText: string) => {
      const receipt = parseReceipt(rawText);
      if (!receipt.items.length && receipt.total == null) toast('info', '商品をうまく読み取れませんでした。確認して入力してください');
      else toast('success', `${receipt.items.length}件の商品を読み取りました`);
      openForm({ parsed: { receipt, rawText, source: 'receipt' } });
    },
    [openForm, toast],
  );

  const onScanError = useCallback(
    (message: string) => {
      toast('error', `読み取りに失敗しました：${message}`);
      openForm({ emptyRow: true, ocrError: message });
    },
    [openForm, toast],
  );

  // ショートカット（画像からテキストを抽出 → クリップボードにコピー）の結果を読み取る
  const readClipboard = async () => {
    let text = '';
    try {
      text = (await navigator.clipboard.readText()).trim();
    } catch {
      toast('info', '貼り付け欄に「ペースト」してください');
      setSheet({ kind: 'text' });
      return;
    }
    if (!text) {
      toast('info', 'コピーされた文字がありません。先にショートカットを実行してください');
      return;
    }
    const receipt = parseReceipt(text);
    if (!receipt.items.length && receipt.total == null) toast('info', '商品をうまく読み取れませんでした。確認して入力してください');
    else toast('success', `${receipt.items.length}件の商品を読み取りました`);
    openForm({ parsed: { receipt, rawText: text, source: 'text' } });
  };

  const current = TABS.find((t) => t.id === tab)!;
  const dayEntries = sheet?.kind === 'day' ? entries.filter((e) => e.date === sheet.date) : [];
  const openEntry = (e: Entry) => openForm({ entry: e });

  return (
    <div className="app">
      <header className="app-header">
        <h1>{current.title}</h1>
      </header>

      <main className="app-main">
        {tab === 'home' && (
          <HomeScreen
            onCamera={() => cameraRef.current?.click()}
            onAlbum={() => albumRef.current?.click()}
            onManual={() => openForm({})}
            onText={() => setSheet({ kind: 'text' })}
            onClipboard={readClipboard}
            onOpen={openEntry}
            onShowHistory={() => setTab('history')}
          />
        )}
        {tab === 'calendar' && <CalendarScreen onSelectDay={(date) => setSheet({ kind: 'day', date })} />}
        {tab === 'analysis' && <AnalysisScreen />}
        {tab === 'history' && <HistoryScreen onOpen={openEntry} />}
        {tab === 'settings' && <SettingsScreen />}
      </main>

      <nav className="tabbar">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}>
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onPick} />
      <input ref={albumRef} type="file" accept="image/*" hidden onChange={onPick} />

      <BottomSheet
        open={sheet?.kind === 'form'}
        title={sheet?.kind === 'form' ? (sheet.init.entry ? '記録を編集' : sheet.init.parsed ? '読み取り結果を確認' : '手入力') : ''}
        onClose={closeSheet}
      >
        {sheet?.kind === 'form' && <EntryForm key={sheet.key} init={sheet.init} onDone={closeSheet} />}
      </BottomSheet>

      <BottomSheet open={sheet?.kind === 'scan'} title="レシートを読み取り中" onClose={() => setSheet(null)}>
        {sheet?.kind === 'scan' && <ScanSheet file={sheet.file} onResult={onScanResult} onError={onScanError} />}
      </BottomSheet>

      <BottomSheet open={sheet?.kind === 'text'} title="文字を貼り付けて読み取る" onClose={() => setSheet(null)}>
        {sheet?.kind === 'text' && (
          <TextImport
            onSubmit={(rawText) => {
              const receipt = parseReceipt(rawText);
              toast('success', `${receipt.items.length}件の商品を読み取りました`);
              openForm({ parsed: { receipt, rawText, source: 'text' } });
            }}
          />
        )}
      </BottomSheet>

      <BottomSheet open={sheet?.kind === 'day'} title={sheet?.kind === 'day' ? formatDateJP(sheet.date, true) : ''} onClose={() => setSheet(null)}>
        {sheet?.kind === 'day' && (
          <div className="form">
            <div className="total-bar">
              <span>この日の合計</span>
              <span className="mono total-amount">{yen(dayEntries.reduce((s, e) => s + entryTotal(e), 0))}</span>
            </div>
            <EntryList entries={dayEntries} onOpen={(e) => openForm({ entry: e }, sheet.date)} showDate={false} empty="この日の記録はありません" />
            <button className="btn btn-primary btn-block" onClick={() => openForm({ date: sheet.date }, sheet.date)}>
              ＋ この日に追加
            </button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
