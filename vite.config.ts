/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

// GitHub Pages のリポジトリ名に合わせる（Actions では BASE_PATH=/<repo名>/ を渡す）
const base = process.env.BASE_PATH ?? '/Kakeibo/';

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? listFiles(p) : [p];
  });
}

/**
 * ビルド後に dist/sw.js を生成する。
 * - アプリ本体（HTML/JS/CSS/アイコン等）は事前キャッシュ
 * - OCR データ（tesseract/）とフォントは初回利用時にキャッシュ（サイズが大きいため）
 */
function serviceWorkerPlugin(): Plugin {
  let outDir = 'dist';
  return {
    name: 'kakeibo-sw',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir;
    },
    closeBundle() {
      const files = listFiles(outDir)
        .map((f) => relative(outDir, f).split('\\').join('/'))
        .filter((f) => f !== 'sw.js' && !f.startsWith('.') && !f.startsWith('tesseract/') && !/\.(woff2?|map)$/.test(f));
      const hash = createHash('sha256');
      for (const f of files) hash.update(f).update(readFileSync(join(outDir, f)));
      const version = hash.digest('hex').slice(0, 12);
      const template = readFileSync(new URL('./src/sw-template.js', import.meta.url), 'utf8');
      const sw = template
        .replace('__VERSION__', version)
        .replace('__PRECACHE__', JSON.stringify(['./', ...files.filter((f) => f !== 'index.html'), 'index.html']));
      writeFileSync(join(outDir, 'sw.js'), sw);
    },
  };
}

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '1.0.0'),
  },
  plugins: [react(), serviceWorkerPlugin()],
  build: {
    chunkSizeWarningLimit: 1200,
    // フォントはbase64でCSSに埋め込まない（必要な文字の分だけ読み込ませる）
    assetsInlineLimit: (file) => (/\.(woff2?)$/.test(file) ? false : undefined),
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
