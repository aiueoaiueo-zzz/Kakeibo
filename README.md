# かけいぼ

レシートを撮ると端末内のOCRで日付・店名・商品・金額を読み取って自動入力する、iPhone向けの家計簿PWA。

- サーバーなし・外部APIなし・運用費0円（データは端末の localStorage に保存）
- OCR は Tesseract.js（日本語）。worker / wasm / 日本語データもすべて GitHub Pages から配信し、外部CDNには通信しない
- オフラインでも閲覧・手入力できる（OCRデータを一度読み込めば読取も可）

## 使い方（iPhone）
1. Safari で `https://<ユーザー名>.github.io/Kakeibo/` を開く
2. 共有ボタン →「ホーム画面に追加」
3. 設定タブの「OCRデータを読み込む」を一度押しておくと、電波がなくてもレシート読取ができる

## 開発
```bash
npm install
npm run dev      # 開発サーバー（http://localhost:5173/Kakeibo/）
npm test         # 解析ロジック等のユニットテスト（Vitest）
npm run build    # dist/ に出力（BASE_PATH=/リポジトリ名/ で base を変更可）
```

## デプロイ
`main` に push すると `.github/workflows/deploy.yml` がテスト→ビルド→GitHub Pages 公開を行う。
初回のみ、リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** にする。

## 構成
| パス | 内容 |
|---|---|
| `src/lib/parseReceipt.ts` | レシート文字列の解析（純粋関数・テストあり） |
| `src/lib/categorize.ts` | カテゴリ自動判定（学習 → キーワード辞書 → 店名辞書 → その他） |
| `src/data/categoryRules.ts` | カテゴリ判定の辞書（追記してよい） |
| `src/lib/storage.ts` | localStorage 読み書きとマイグレーション（`SCHEMA_VERSION`） |
| `src/lib/ocr.ts` / `imagePreprocess.ts` | Tesseract.js と画像前処理（縮小・グレースケール・二値化） |
| `src/sw-template.js` | Service Worker（ビルド時に `dist/sw.js` を生成） |
| `scripts/copy-ocr-assets.mjs` | OCR用ファイルを `public/tesseract/` にコピー（dev/build前に自動実行） |

## データ構造を変えるとき
`src/lib/storage.ts` の `SCHEMA_VERSION` を上げ、`MIGRATIONS` に移行処理を追加する。起動時に自動で移行され、既存データは消えない。

## iPhoneショートカット連携（高精度な読取）
iPhone標準の文字認識（端末内・無料・通信なし）を使うと、アプリ内OCRより正確に読める。
1. ショートカットアプリで新規作成し、**写真を撮る → 画像からテキストを抽出 → クリップボードにコピー** の順にアクションを追加
2. ショートカットで撮影 → かけいぼのホームで **📋 コピーした文字から読み取る** →「ペースト」→ 確認して保存

※ ホーム画面に追加したアプリと Safari はデータの保存場所が別なので、URLで文字を渡す方式ではなくクリップボード経由にしている。
