import { useState } from 'react';
import { useToast } from '../state/toast';

export function TextImport({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [text, setText] = useState('');
  const toast = useToast();

  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (!t) toast('info', 'クリップボードが空です');
      else setText(t);
    } catch {
      toast('info', '下の欄を長押しして「ペースト」してください');
    }
  };

  return (
    <div className="form">
      <ol className="howto">
        <li>写真アプリでレシートの写真を開く</li>
        <li>右下の「テキスト認識」ボタン（または文字を長押し）→「すべてを選択」→「コピー」</li>
        <li>ここに貼り付けて「読み取る」</li>
      </ol>
      <button className="btn btn-ghost btn-block" onClick={paste}>
        📋 クリップボードから貼り付け
      </button>
      <textarea className="paste-area" value={text} onChange={(e) => setText(e.target.value)} rows={10} placeholder="ここにレシートの文字を貼り付け" />
      <button className="btn btn-primary btn-block" disabled={!text.trim()} onClick={() => onSubmit(text)}>
        読み取る
      </button>
    </div>
  );
}
