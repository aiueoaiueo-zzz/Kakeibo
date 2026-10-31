import type { Category } from '../types';

export const OTHER_ID = 'other';
export const TRANSPORT_ID = 'transport';

/** 標準カテゴリ（id は固定。マイグレーションで不足分を追加する） */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'food', name: '食費', emoji: '🍙', color: '#c8f542', builtIn: true },
  { id: 'daily', name: '日用品', emoji: '🧴', color: '#2fd0a0', builtIn: true },
  { id: TRANSPORT_ID, name: '交通費', emoji: '🚃', color: '#4278f5', builtIn: true },
  { id: 'dining', name: '外食', emoji: '🍜', color: '#f5a842', builtIn: true },
  { id: 'fun', name: '娯楽', emoji: '🎮', color: '#a842f5', builtIn: true },
  { id: 'clothes', name: '衣服', emoji: '👕', color: '#f542a8', builtIn: true },
  { id: 'beauty', name: '美容', emoji: '💄', color: '#f5e642', builtIn: true },
  { id: 'medical', name: '医療', emoji: '🏥', color: '#f54242', builtIn: true },
  { id: 'telecom', name: '通信', emoji: '📱', color: '#42c8f5', builtIn: true },
  { id: 'housing', name: '住居', emoji: '🏠', color: '#e8e0d0', builtIn: true },
  { id: 'resale', name: '転売仕入れ', emoji: '📦', color: '#ff6b35', builtIn: true },
  { id: OTHER_ID, name: 'その他', emoji: '🔖', color: '#8a8a99', builtIn: true },
];
