import { useEffect, useRef, useState } from 'react';
import { preprocessImage } from '../lib/imagePreprocess';
import { recognizeImage, type OcrProgress } from '../lib/ocr';

interface Props {
  file: File;
  onResult: (rawText: string) => void;
  onError: (message: string) => void;
}

/** 撮影した画像を前処理して OCR する（シートが開いたら即開始） */
export function ScanSheet({ file, onResult, onError }: Props) {
  const [preview, setPreview] = useState<string>('');
  const [progress, setProgress] = useState<OcrProgress>({ status: '画像を準備中', progress: 0 });
  const started = useRef<File | null>(null);
  const cbs = useRef({ onResult, onError });
  cbs.current = { onResult, onError };

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (started.current === file) return;
    started.current = file;
    (async () => {
      try {
        setProgress({ status: '画像を補正中', progress: 0 });
        const canvas = await preprocessImage(file);
        const text = await recognizeImage(canvas, setProgress);
        cbs.current.onResult(text);
      } catch (e) {
        cbs.current.onError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [file]);

  const pct = Math.round(progress.progress * 100);
  return (
    <div className="scan">
      {preview && <img className="scan-preview" src={preview} alt="撮影したレシート" />}
      <div className="progress-label">
        <span>{progress.status}…</span>
        <span className="mono">{pct}%</span>
      </div>
      <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress-bar" style={{ width: `${pct}%` }} />
      </div>
      <p className="hint">端末の中だけで読み取っています（画像は外部に送信されません）。初回は日本語データの読み込みに少し時間がかかります。</p>
    </div>
  );
}
