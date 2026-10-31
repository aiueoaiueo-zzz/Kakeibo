import { describe, expect, it } from 'vitest';
import { cleanOcrText } from './ocr';

describe('cleanOcrText', () => {
  it('数字の読み間違いを補正する', () => {
    expect(cleanOcrText('お預り \\1O00')).toBe('お預り \\1000');
    expect(cleanOcrText('おにぎり 1 5 0')).toBe('おにぎり 150');
    expect(cleanOcrText('牛乳 2l8')).toBe('牛乳 218');
    expect(cleanOcrText('DOLE バナナ 198')).toBe('DOLE バナナ 198');
  });
});
