import { describe, expect, it } from 'vitest';
import { categorize, learnFromEntry } from './categorize';
import { DEFAULT_CATEGORIES } from '../data/defaultCategories';
import type { Entry, Learned } from '../types';

const empty: Learned = { stores: {}, items: {} };
const cats = DEFAULT_CATEGORIES;

describe('categorize', () => {
  it('商品名のキーワード', () => {
    expect(categorize({ itemName: 'おにぎり 鮭' }, empty, cats)).toBe('food');
    expect(categorize({ itemName: 'ティッシュ5箱' }, empty, cats)).toBe('daily');
    expect(categorize({ itemName: '運賃' }, empty, cats)).toBe('transport');
  });
  it('店名の辞書', () => {
    expect(categorize({ itemName: 'ABC123', storeName: 'ローソン 渋谷店' }, empty, cats)).toBe('food');
    expect(categorize({ itemName: 'ABC123', storeName: 'マツモトキヨシ' }, empty, cats)).toBe('daily');
  });
  it('どれにも当てはまらなければその他', () => {
    expect(categorize({ itemName: 'なぞのもの', storeName: 'なぞの店' }, empty, cats)).toBe('other');
  });
  it('一度保存した店名・商品名は次回から同じカテゴリになる', () => {
    const entry: Entry = {
      id: '1',
      date: '2026-10-31',
      storeName: 'ハードオフ 渋谷店',
      paymentMethod: '現金',
      items: [
        { id: 'a', name: 'ゲーム機ジャンク', amount: 3000, categoryId: 'resale' },
        { id: 'b', name: 'おにぎり', amount: 150, categoryId: 'resale' },
      ],
      source: 'manual',
      createdAt: '',
      updatedAt: '',
    };
    const learned = learnFromEntry(empty, entry);
    expect(categorize({ itemName: 'ゲーム機ジャンク' }, learned, cats)).toBe('resale');
    expect(categorize({ itemName: 'おにぎり' }, learned, cats)).toBe('resale'); // 学習は辞書より優先
    expect(categorize({ itemName: '未知の品', storeName: 'ハードオフ渋谷店' }, learned, cats)).toBe('resale');
  });
});
