/** 全角英数・記号を半角に、半角カナを全角にする（NFKC）。￥→¥ */
export function normalizeText(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/[￥\\]/g, '¥')
    .replace(/[‐‑‒–—―−]/g, '-')
    .replace(/\r\n?/g, '\n');
}

/** 学習・辞書照合用のキー（空白除去・小文字化） */
export function keyOf(s: string): string {
  return normalizeText(s).replace(/\s+/g, '').toLowerCase();
}
