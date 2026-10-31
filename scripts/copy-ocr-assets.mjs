// Tesseract.js の worker / コア(wasm) / 日本語データを public/tesseract にコピーする。
// これにより OCR に必要なファイルもすべて GitHub Pages から配信され、外部CDNへの通信が発生しない。
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'tesseract');
const pkgDir = (name) => dirname(require.resolve(`${name}/package.json`));

const copies = [
  [join(pkgDir('tesseract.js'), 'dist', 'worker.min.js'), join(out, 'worker.min.js')],
  // OEM = LSTM_ONLY で使うコアのみ（端末の SIMD 対応状況で自動選択される）
  ...['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'].map(
    (f) => [join(pkgDir('tesseract.js-core'), f), join(out, 'core', f)],
  ),
  [join(pkgDir('@tesseract.js-data/jpn'), '4.0.0_best_int', 'jpn.traineddata.gz'), join(out, 'lang', 'jpn.traineddata.gz')],
];

for (const [src, dest] of copies) {
  if (!existsSync(src)) throw new Error(`見つかりません: ${src}`);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
}
console.log(`OCR assets copied to ${out}`);
