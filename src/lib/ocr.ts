import type { Worker } from 'tesseract.js';

export interface OcrProgress {
  status: string;
  progress: number; // 0〜1（全体）
}

const STATUS_JP: Record<string, string> = {
  'loading tesseract core': 'OCRエンジンを読み込み中',
  'initializing tesseract': 'OCRエンジンを準備中',
  'initialized tesseract': 'OCRエンジンを準備中',
  'loading language traineddata': '日本語データを読み込み中',
  'loading language traineddata (from cache)': '日本語データを読み込み中',
  'loaded language traineddata': '日本語データを読み込み中',
  'initializing api': '準備中',
  'initialized api': '準備中',
  'recognizing text': '文字を読み取り中',
};

// 全体の進み具合のうち、各段階が占める範囲
const STAGE: Record<string, [number, number]> = {
  'loading tesseract core': [0, 0.1],
  'loading language traineddata': [0.1, 0.3],
  'initializing api': [0.3, 0.35],
  'recognizing text': [0.35, 1],
};

let workerPromise: Promise<Worker> | null = null;
let onProgress: ((p: OcrProgress) => void) | null = null;

const abs = (p: string) => new URL(`${import.meta.env.BASE_URL}${p}`, location.href).href;

export class OcrNetworkError extends Error {}

let lastActivity = 0;
const STALL_MS = 60_000;

/** 一定時間進捗がなければ失敗扱いにする（読み込みが止まったまま固まるのを防ぐ） */
function withStallTimeout<T>(p: Promise<T>): Promise<T> {
  lastActivity = Date.now();
  return new Promise<T>((resolve, reject) => {
    const timer = setInterval(() => {
      if (Date.now() - lastActivity > STALL_MS) {
        clearInterval(timer);
        reject(new Error('OCRデータの読み込みが進みません（network timeout）'));
      }
    }, 2000);
    p.then(
      (v) => {
        clearInterval(timer);
        resolve(v);
      },
      (e) => {
        clearInterval(timer);
        reject(e);
      },
    );
  });
}

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, PSM } = await import('tesseract.js');
      // worker の読み込み失敗は Tesseract.js 側でエラーにならず止まってしまうため、先に確認する
      const res = await fetch(abs('tesseract/worker.min.js'), { method: 'GET' });
      if (!res.ok) throw new Error(`OCRファイルを取得できません (HTTP ${res.status})`);
      const worker = await withStallTimeout(createWorker('jpn', 1, {
        workerPath: abs('tesseract/worker.min.js'),
        corePath: abs('tesseract/core'),
        langPath: abs('tesseract/lang'),
        gzip: true,
        workerBlobURL: false,
        logger: (m) => {
          lastActivity = Date.now();
          const key = Object.keys(STAGE).find((k) => m.status.startsWith(k));
          const [a, b] = key ? STAGE[key] : [0, 0];
          onProgress?.({
            status: STATUS_JP[m.status] ?? m.status,
            progress: key ? a + (b - a) * (m.progress || 0) : 0,
          });
        },
        errorHandler: (e) => console.error('tesseract', e),
      }));
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        preserve_interword_spaces: '1',
      });
      return worker;
    })();
    workerPromise.catch(() => {
      workerPromise = null;
    });
  }
  return workerPromise;
}

function friendly(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e ?? '不明なエラー');
  if (!navigator.onLine || /fetch|network|load|importScripts|NetworkError|Failed/i.test(msg)) {
    return new OcrNetworkError(`初回はネットにつないだ状態で読取してください（${msg}）`);
  }
  return e instanceof Error ? e : new Error(msg);
}

/** OCR 用の日本語データ等を事前に読み込む（オフラインで使うため） */
export async function prepareOcr(progress?: (p: OcrProgress) => void): Promise<void> {
  onProgress = progress ?? null;
  try {
    await getWorker();
  } catch (e) {
    throw friendly(e);
  } finally {
    onProgress = null;
  }
}

/** OCR の結果を解析しやすく整える（「1 5 0」→「150」など） */
export function cleanOcrText(text: string): string {
  return text
    .split('\n')
    .map((l) =>
      l
        .replace(/(?<!\d)\d(?: \d)+(?!\d)/g, (m) => m.replace(/ /g, ''))
        // 数字の中に紛れた O/o/D → 0、l/I/| → 1（例：\1O00 → \1000）
        .replace(/(?<=\d)[OoD](?=[\dOoD]*(?:\D|$))|(?<=[¥\\]\d*)[OoD]/g, '0')
        .replace(/(?<=\d)[lI|](?=\d)/g, '1'),
    )
    .join('\n');
}

export async function recognizeImage(image: HTMLCanvasElement | Blob, progress: (p: OcrProgress) => void): Promise<string> {
  onProgress = progress;
  try {
    progress({ status: 'OCRエンジンを準備中', progress: 0 });
    let worker: Worker;
    try {
      worker = await getWorker();
    } catch (e) {
      throw friendly(e);
    }
    const { data } = await worker.recognize(image);
    progress({ status: '完了', progress: 1 });
    return cleanOcrText(data.text ?? '');
  } finally {
    onProgress = null;
  }
}
