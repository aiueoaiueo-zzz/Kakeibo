/**
 * OCR 前処理：長辺1600pxに合わせて拡縮 → グレースケール → コントラスト強調 → 二値化（適応的しきい値）
 */
const TARGET_LONG_SIDE = 1600;

async function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    if (img.decode) {
      await img.decode();
    } else {
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error('画像を読み込めませんでした'));
      });
    }
    return img;
  } catch {
    throw new Error('画像を読み込めませんでした（対応していない形式の可能性があります）');
  } finally {
    // decode 済みなので URL は解放してよい
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export async function preprocessImage(file: Blob): Promise<HTMLCanvasElement> {
  const img = await loadImage(file);
  const w0 = img.naturalWidth;
  const h0 = img.naturalHeight;
  if (!w0 || !h0) throw new Error('画像のサイズを取得できませんでした');
  const scale = TARGET_LONG_SIDE / Math.max(w0, h0);
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas を使用できません');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);

  const imageData = ctx.getImageData(0, 0, w, h);
  const px = imageData.data;
  const n = w * h;

  // グレースケール
  const gray = new Uint8ClampedArray(n);
  const hist = new Uint32Array(256);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const g = (px[j] * 299 + px[j + 1] * 587 + px[j + 2] * 114) / 1000;
    gray[i] = g;
    hist[gray[i]]++;
  }

  // コントラスト強調（上下2%を切り捨てて引き伸ばす）
  const cut = n * 0.02;
  let lo = 0;
  let hi = 255;
  for (let acc = 0; lo < 255 && acc + hist[lo] < cut; lo++) acc += hist[lo];
  for (let acc = 0; hi > 0 && acc + hist[hi] < cut; hi--) acc += hist[hi];
  const range = Math.max(1, hi - lo);
  for (let i = 0; i < n; i++) gray[i] = ((gray[i] - lo) * 255) / range;

  // 二値化（Bradley の適応的しきい値：影や照明ムラに強い）
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 1; y <= h; y++) {
    let rowSum = 0;
    for (let x = 1; x <= w; x++) {
      rowSum += gray[(y - 1) * w + (x - 1)];
      integral[y * (w + 1) + x] = integral[(y - 1) * (w + 1) + x] + rowSum;
    }
  }
  const s = Math.max(8, Math.floor(Math.max(w, h) / 16) >> 1);
  const t = 0.15;
  for (let y = 0; y < h; y++) {
    const y1 = Math.max(0, y - s);
    const y2 = Math.min(h - 1, y + s);
    for (let x = 0; x < w; x++) {
      const x1 = Math.max(0, x - s);
      const x2 = Math.min(w - 1, x + s);
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum =
        integral[(y2 + 1) * (w + 1) + (x2 + 1)] -
        integral[y1 * (w + 1) + (x2 + 1)] -
        integral[(y2 + 1) * (w + 1) + x1] +
        integral[y1 * (w + 1) + x1];
      const v = gray[y * w + x] * count <= sum * (1 - t) ? 0 : 255;
      const j = (y * w + x) * 4;
      px[j] = px[j + 1] = px[j + 2] = v;
      px[j + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}
