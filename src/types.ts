export type PaymentMethod = '現金' | 'クレカ' | '電子マネー' | 'ポイント' | 'クーポン' | '混合' | 'その他';

export const PAYMENT_METHODS: PaymentMethod[] = ['現金', 'クレカ', '電子マネー', 'ポイント', 'クーポン', '混合', 'その他'];

export interface Item {
  id: string;
  name: string; // 商品名（交通費モードでは「運賃」など）
  amount: number; // 円・整数
  categoryId: string; // 商品ごとにカテゴリを持つ
}

export interface Transit {
  fromStation: string; // 乗車駅
  toStation: string; // 降車駅
  line: string; // 交通機関（例：JR山手線）
}

export interface Entry {
  id: string;
  date: string; // YYYY-MM-DD
  storeName: string; // 店名（交通費モードでは空でもよい）
  transit?: Transit;
  paymentMethod: PaymentMethod;
  items: Item[];
  memo?: string;
  source: 'receipt' | 'manual';
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string; // HEX
  builtIn: boolean; // 標準カテゴリは削除不可
}

/** 学習データ：正規化した名前 → カテゴリID */
export interface Learned {
  stores: Record<string, string>;
  items: Record<string, string>;
}

export type Tab = 'home' | 'calendar' | 'analysis' | 'history' | 'settings';
