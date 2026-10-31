import { describe, expect, it } from 'vitest';
import { detectPaymentMethod, parseDate, parseReceipt } from './parseReceipt';

const TODAY = '2026-10-31';

describe('parseDate', () => {
  it.each([
    ['2026/10/31 12:34', '2026-10-31'],
    ['2026年10月31日(土) 12:34', '2026-10-31'],
    ['２０２６年１０月３１日', '2026-10-31'],
    ['26/10/31 18:05', '2026-10-31'],
    ['R8.10.31', '2026-10-31'],
    ['令和8年10月31日', '2026-10-31'],
    ['令和元年5月1日', '2019-05-01'],
    ['H31.4.30', '2019-04-30'],
    ['2026-01-05', '2026-01-05'],
    ['10月31日', '2026-10-31'],
  ])('%s → %s', (input, expected) => {
    expect(parseDate(input, TODAY)).toBe(expected);
  });

  it('電話番号や存在しない日付は日付と見なさない', () => {
    expect(parseDate('TEL 03-1234-5678', TODAY)).toBeNull();
    expect(parseDate('2026/13/45', TODAY)).toBeNull();
  });

  it('読めなければ今日の日付', () => {
    const r = parseReceipt('おにぎり 150', TODAY);
    expect(r.date).toBe(TODAY);
    expect(r.dateFound).toBe(false);
  });
});

describe('parseReceipt：コンビニのレシート', () => {
  const text = `セブン-イレブン
渋谷道玄坂店
東京都渋谷区道玄坂1-2-3
TEL 03-1234-5678
領収書
2026年10月31日(土) 12:34 レジ1
おにぎり 鮭        ¥150※
サンドイッチ        ¥398※
お茶 ５００ｍｌ      ￥１２０
小計              ¥668
消費税等(8%)       ¥49
合計              ¥668
(8%対象 ¥668)
お預り            ¥1,000
お釣り             ¥332`;

  const r = parseReceipt(text, TODAY);

  it('店名', () => expect(r.storeName).toBe('セブン-イレブン 渋谷道玄坂店'));
  it('日付', () => expect(r.date).toBe('2026-10-31'));
  it('商品（小計・税・お預り・お釣りは除外）', () => {
    expect(r.items).toEqual([
      { name: 'おにぎり鮭', amount: 150 }, // OCR対策で和文間の空白は詰める
      { name: 'サンドイッチ', amount: 398 },
      { name: 'お茶 500ml', amount: 120 },
    ]);
  });
  it('合計', () => expect(r.total).toBe(668));
  it('支払い方法：お預り → 現金', () => expect(r.paymentMethod).toBe('現金'));
  it('交通費ではない', () => expect(r.isTransit).toBe(false));
});

describe('parseReceipt：値引', () => {
  it('値引行は直前の商品から引く', () => {
    const r = parseReceipt(
      `スーパーマルエツ
2026/10/30
牛乳 238
値引 -50
食パン 158
割引 ▲30
合計 316`,
      TODAY,
    );
    expect(r.items).toEqual([
      { name: '牛乳', amount: 188 },
      { name: '食パン', amount: 128 },
    ]);
    expect(r.total).toBe(316);
  });

  it('金額だけのマイナス行も直前の商品から引く', () => {
    const r = parseReceipt(`弁当 500\n-100\n合計 400`, TODAY);
    expect(r.items).toEqual([{ name: '弁当', amount: 400 }]);
  });
});

describe('parseReceipt：合計の不一致', () => {
  it('レシートの合計と商品の合計が違うことを検出できる', () => {
    const r = parseReceipt(
      `ローソン
2026/10/31
からあげクン 238
ペットボトル水 110
コーヒー 150
カップ麺 732
合計 ¥1,280`,
      TODAY,
    );
    const sum = r.items.reduce((s, i) => s + i.amount, 0);
    expect(r.total).toBe(1280);
    expect(sum).toBe(1230);
    expect(sum).not.toBe(r.total);
  });
});

describe('parseReceipt：書式いろいろ', () => {
  it('数量行（2コX単150）と次行の金額', () => {
    const r = parseReceipt(
      `ファミリーマート
26/10/31
おにぎり
 2コX単150     300
合計
¥300`,
      TODAY,
    );
    expect(r.items).toEqual([{ name: 'おにぎり', amount: 300 }]);
    expect(r.total).toBe(300);
    expect(r.date).toBe('2026-10-31');
  });

  it('OCRで文字の間に空白が入っても読める', () => {
    const r = parseReceipt(`お に ぎ り  ¥1 5 0\nパ ン   ¥2,000`, TODAY);
    expect(r.items[1]).toEqual({ name: 'パン', amount: 2000 });
  });

  it('円表記・カンマ・全角数字', () => {
    const r = parseReceipt(`シャンプー　１，２８０円\n合計　１，２８０円`, TODAY);
    expect(r.items).toEqual([{ name: 'シャンプー', amount: 1280 }]);
    expect(r.total).toBe(1280);
  });
});

describe('支払い方法の判定', () => {
  it.each([
    ['クレジット 1,280', 'クレカ'],
    ['VISA ****1234', 'クレカ'],
    ['Mastercard', 'クレカ'],
    ['JCB 一括', 'クレカ'],
    ['Suica支払 ¥500', '電子マネー'],
    ['PASMO', '電子マネー'],
    ['iD 決済', '電子マネー'],
    ['QUICPay', '電子マネー'],
    ['PayPay ¥300', '電子マネー'],
    ['楽天ペイ', '電子マネー'],
    ['お預り ¥1,000', '現金'],
    ['現金 ¥500', '現金'],
    ['なにもなし', '現金'],
  ])('%s → %s', (text, expected) => {
    expect(detectPaymentMethod(text)).toBe(expected);
  });

  it('ID（大文字）は iD と判定しない', () => {
    expect(detectPaymentMethod('会員ID 1234')).toBe('現金');
  });
});

describe('交通費', () => {
  it('乗車券・運賃があれば交通費として区間と路線を読み取る', () => {
    const r = parseReceipt(
      `JR東日本
領収書
2026年10月31日
乗車券 渋谷→新宿
JR山手線
運賃 ¥170
Suica`,
      TODAY,
    );
    expect(r.isTransit).toBe(true);
    expect(r.transit).toEqual({ fromStation: '渋谷', toStation: '新宿', line: 'JR山手線' });
    expect(r.items).toEqual([{ name: '運賃', amount: 170 }]);
    expect(r.paymentMethod).toBe('電子マネー');
  });
});
