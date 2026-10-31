import { StrictMode, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/zen-kaku-gothic-new/400.css';
import '@fontsource/zen-kaku-gothic-new/700.css';
import '@fontsource/dm-mono/400.css';
import '@fontsource/dm-mono/500.css';
import './styles.css';
import App from './App';
import { StoreProvider } from './state/store';
import { ToastProvider, useToast } from './state/toast';

function Root() {
  const toast = useToast();
  const onError = useCallback((msg: string) => toast('error', msg), [toast]);
  return (
    <StoreProvider onError={onError}>
      <App />
    </StoreProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <Root />
    </ToastProvider>
  </StrictMode>,
);

// Service Worker（本番ビルドのみ）
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch((e) => console.warn('SW登録失敗', e));
  });
}

// ブラウザにデータを消されにくくする
navigator.storage?.persist?.().catch(() => {});
