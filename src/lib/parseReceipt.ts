import type { PaymentMethod, Transit } from '../types';
import { STORE_KEYWORDS } from '../data/categoryRules';
import { normalizeText, keyOf } from './text';
import { todayISO } from './format';

export interface ParsedItem {
  name: string;
  amount: number;
}

export interface ParsedReceipt {
  date: string; // YYYY-MM-DD（読めなければ today）
  dateFound: boolean;
  storeName: string;
  items: ParsedItem[];
  total: number | null; // レシートの「合計」
  paymentMethod: PaymentMethod;
  isTransit: boolean;
  transit: Transit | null;
}

const CJK = '\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}ー々〆';
const RE_CJK_SPACE = new RegExp(`([${CJK}])[ \\t\\u3000]+(?=[${CJK}])`, 'gu');

/** 小計・合計・税・お預り などの「商品ではない行」 */
const RE_NON_ITEM =
  /小計|合計|総計|^計$|税|対象|預り|預かり|釣|おつり|値引|割引|ポイント|点数|^\d+点|現金|クレジット|カード|支払|残高|電子マネー|交通系|領収|レシート|TEL|電話|^No\b|レジ|担当|取引|伝票|番号|承認|会員|ありがとう|端数|買上|お会計|請求|\d{1,2}:\d{2}/i;
const RE_TOTAL = /合計|総計|お?買上げ?計|ご?請求額|お会計/;
const RE_TOTAL_NG = /小計|対象|消費税|内税|外税|点数/;
const RE_DISCOUNT = /値引|割引|引き|クーポン|OFF|off/;
const RE_QTY = /^(?:\d+\s*(?:個|コ|点|本|袋|パック)?\s*[x×X*]\s*(?:単価?)?\s*¥?\s*\d+|@\s*¥?\s*\d+|単価?\s*¥?\s*\d+)/;
const RE_TRAILING_MARK = /\s*(?:※|\*|★|☆|◎|#|軽|外|内|非|T|\([^()]{1,4}\)|\d{1,2}%)$/;
const RE_LINE_AMOUNT = /^(.*?)\s*([-△▲]?)\s*¥?\s*([-△▲]?)\s*(\d{1,8})$/;

const STORE_NG =
  /領収|レシート|receipt|いらっしゃい|ありがとう|毎度|ご来店|ご利用|お買上|明細|登録番号|^T\d{6,}|〒|丁目|番地|TEL|電話|FAX|営業時間|^\d+$/i;
const RE_ADDRESS = /(都|道|府|県).*(市|区|町|村|郡)|^\S+[市区町村]\S*\d|\d+-\d+(-\d+)?$/;
const RE_PHONE = /\d{2,4}-\d{2,4}-\d{3,4}|\(\d{2,4}\)\d{2,4}-\d{3,4}/;

function cleanLine(line: string): string {
  return line
    .replace(RE_CJK_SPACE, '$1')
    .replace(/(\d)\s*[,.]\s*(\d{3})(?!\d)/g, '$1$2') // 1,280 / 1.280 / 1, 280 → 1280
    .replace(/(\d)[,.](\d{3})(?!\d)/g, '$1$2')
    .replace(/(\d)\s*円/g, '$1')
    .replace(/¥\s+/g, '¥')
    .replace(/[ \t\u3000]+/g, ' ')
    .trim();
}

function stripTrailingMarks(s: string): string {
  let prev;
  do {
    prev = s;
    s = s.replace(RE_TRAILING_MARK, '');
  } while (s !== prev);
  return s.trim();
}

interface LineAmount {
  name: string;
  amount: number;
  negative: boolean;
}

/** 行の末尾にある金額を読み取る */
function lineAmount(line: string): LineAmount | null {
  const m = stripTrailingMarks(line).match(RE_LINE_AMOUNT);
  if (!m) return null;
  return {
    name: m[1].replace(/[\s:：.・…_]+$/, '').trim(),
    amount: Number(m[4]),
    negative: Boolean(m[2] || m[3]),
  };
}

const hasLetter = (s: string) => /\p{L}/u.test(s);

function validDate(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1) return null;
  const last = new Date(y, m, 0).getDate();
  if (d > last) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const eraYear = (s: string) => (s === '元' ? 1 : Number(s));

/** 日付を読み取る：2026/10/31・2026年10月31日・26/10/31・R8.10.31・令和8年… */
export function parseDate(text: string, today = todayISO()): string | null {
  const t = normalizeText(text).replace(RE_CJK_SPACE, '$1');
  const SEP = '\\s*[年./-]\\s*';
  const SEP2 = '\\s*[月./-]\\s*';
  const patterns: [RegExp, (m: RegExpMatchArray) => string | null][] = [
    [new RegExp(`(?:令和|R)\\s*(元|\\d{1,2})${SEP}(\\d{1,2})${SEP2}(\\d{1,2})`, 'g'), (m) => validDate(2018 + eraYear(m[1]), +m[2], +m[3])],
    [new RegExp(`(?:平成|H)\\s*(元|\\d{1,2})${SEP}(\\d{1,2})${SEP2}(\\d{1,2})`, 'g'), (m) => validDate(1988 + eraYear(m[1]), +m[2], +m[3])],
    [new RegExp(`((?:19|20)\\d{2})${SEP}(\\d{1,2})${SEP2}(\\d{1,2})`, 'g'), (m) => validDate(+m[1], +m[2], +m[3])],
    [/(?<![\d./-])(\d{2})[./](\d{1,2})[./](\d{1,2})(?!\d)/g, (m) => validDate(2000 + +m[1], +m[2], +m[3])],
    [/(?<!\d)(\d{1,2})月\s*(\d{1,2})日/g, (m) => validDate(+today.slice(0, 4), +m[1], +m[2])],
  ];
  for (const [re, toDate] of patterns) {
    for (const m of t.matchAll(re)) {
      const d = toDate(m);
      if (d) return d;
    }
  }
  return null;
}

/** 支払い方法をキーワードで判定（判定できなければ現金） */
export function detectPaymentMethod(text: string): PaymentMethod {
  const t = normalizeText(text);
  if (/クレジット|クレカ|VISA|Master\s*Card|MASTER|JCB|AMEX|American\s*Express|ダイナース|Diners|credit/i.test(t)) return 'クレカ';
  if (
    /Suica|PASMO|ICOCA|Kitaca|TOICA|manaca|SUGOCA|nimoca|交通系|QUICPay|PayPay|楽天ペイ|楽天Edy|Edy|nanaco|WAON|d払い|au\s*PAY|メルペイ|LINE\s*Pay|電子マネー/i.test(t) ||
    /(?<![A-Za-z])iD(?![A-Za-z])/.test(t)
  )
    return '電子マネー';
  if (/預り|預かり|現金|釣/.test(t)) return '現金';
  return '現金';
}

function findStoreName(lines: string[]): string {
  const head = lines.slice(0, 8);
  // 次の行が「〇〇店」なら支店名としてつなげる
  const withBranch = (i: number) => {
    const l = head[i];
    const next = head[i + 1];
    if (next && /店$/.test(next) && next.length <= 15 && !RE_ADDRESS.test(next) && !l.endsWith('店')) return `${l} ${next}`;
    return l;
  };
  // 1) 店名辞書に載っている店が上の方にあればそれを使う
  const known = Object.values(STORE_KEYWORDS).flat().map((w) => keyOf(w)).filter((w) => w.length >= 3);
  for (let i = 0; i < head.length; i++) {
    const l = head[i];
    const k = keyOf(l);
    if (known.some((w) => k.includes(w)) && !RE_PHONE.test(l) && !RE_ADDRESS.test(l) && !lineAmountIsPrice(l)) return withBranch(i);
  }
  // 2) 電話番号・住所・日付・「領収書」などではない最初の行
  for (let i = 0; i < head.length; i++) {
    const l = head[i];
    if (l.length < 2 || !hasLetter(l)) continue;
    if (STORE_NG.test(l) || RE_ADDRESS.test(l) || RE_PHONE.test(l) || parseDate(l)) continue;
    if (/\d{1,2}:\d{2}/.test(l) || lineAmountIsPrice(l)) continue;
    return withBranch(i);
  }
  return '';
}

function lineAmountIsPrice(l: string): boolean {
  const a = lineAmount(l);
  return Boolean(a && a.name && hasLetter(a.name) && (/¥/.test(l) || a.amount >= 10));
}

function parseTransit(t: string): Transit | null {
  const st = t.match(/([\p{L}ー]{1,12}?)駅?\s*(?:→|⇒|->|➡|～|〜|から)\s*([\p{L}ー]{1,12}?)駅?(?=[\s\d¥]|まで|$)/mu);
  const line =
    t.match(/((?:JR|東京|大阪)?[\p{L}ー]{1,10}?線)/u) ??
    t.match(/([\p{L}ー]{1,10}?(?:メトロ|鉄道|電鉄|バス))/u) ??
    t.match(/(JR[\p{L}ー]*)/u);
  if (!st && !line) return null;
  const station = (s?: string) => (s ?? '').replace(/^(?:乗車券|きっぷ|切符|普通券|回数券|特急券|区間|運賃)/, '');
  return {
    fromStation: station(st?.[1]),
    toStation: station(st?.[2]),
    line: line?.[1] ?? '',
  };
}

/**
 * 商品名と金額が別々の行に分かれているとき、名前の行と金額の行をつなげる。
 * iPhone のテキスト認識でコピーすると、列ごとにまとまって
 *   おにぎり / お茶 / 合計 / ¥150 / ¥120 / ¥270
 * のように並ぶことがあるため、「金額だけの行」が K 行続いたら、
 * その直前にある「金額のない行」の後ろから K 行と順番に組み合わせる。
 */
export function pairSplitColumns(lines: string[], isLabelOnly: (l: string) => boolean, isAmountOnly: (l: string) => boolean): string[] {
  const out = [...lines];
  const removed = new Set<number>();
  let labels: number[] = [];
  let i = 0;
  while (i < out.length) {
    if (isAmountOnly(out[i])) {
      const run: number[] = [];
      while (i < out.length && isAmountOnly(out[i])) run.push(i++);
      const m = Math.min(run.length, labels.length);
      const use = labels.slice(labels.length - m);
      use.forEach((li, k) => {
        out[li] = `${out[li]} ${out[run[k]]}`;
        removed.add(run[k]);
      });
      labels = [];
      continue;
    }
    if (isLabelOnly(out[i])) labels.push(i);
    else labels = []; // 金額つきの行で区切る
    i++;
  }
  return out.filter((_, idx) => !removed.has(idx));
}

/** レシートの文字列を解析する（純粋関数） */
export function parseReceipt(text: string, today = todayISO()): ParsedReceipt {
  const normalized = normalizeText(text);
  const rawLines = normalized
    .split('\n')
    .map(cleanLine)
    .filter((l) => l.length > 0);

  const date = parseDate(normalized, today);
  const storeName = findStoreName(rawLines);
  const isStoreLine = (l: string) => Boolean(storeName) && (l === storeName || storeName.split(' ').includes(l));
  const isDateOrPhone = (l: string) => Boolean(parseDate(l, today)) || RE_PHONE.test(l);
  const lines = pairSplitColumns(
    rawLines,
    (l) => !isStoreLine(l) && (isDateOrPhone(l) ? false : lineAmount(l) == null) && hasLetter(l),
    (l) => !isDateOrPhone(l) && lineAmount(l)?.name === '',
  );

  const items: ParsedItem[] = [];
  let total: number | null = null;
  let pendingName: string | null = null; // 金額が次の行にある商品名
  let pendingTotal = false; // 「合計」の金額が次の行にある

  for (const line of lines) {
    if (isStoreLine(line)) continue;
    const isDateLine = isDateOrPhone(line);
    const la = isDateLine ? null : lineAmount(line);

    // 金額だけの行（前の行の続き）
    if (la && !la.name) {
      if (pendingTotal) {
        total ??= la.amount;
      } else if (la.negative) {
        if (items.length) items[items.length - 1].amount = Math.max(0, items[items.length - 1].amount - la.amount);
      } else if (pendingName) {
        items.push({ name: pendingName, amount: la.amount });
      }
      pendingName = null;
      pendingTotal = false;
      continue;
    }
    pendingTotal = false;

    if (!la) {
      // 金額のない行
      if (RE_TOTAL.test(line) && !RE_TOTAL_NG.test(line)) {
        pendingTotal = total == null;
        pendingName = null;
      } else if (!isDateLine && hasLetter(line) && !RE_NON_ITEM.test(line) && !STORE_NG.test(line) && !RE_ADDRESS.test(line)) {
        pendingName = line;
      } else {
        pendingName = null;
      }
      continue;
    }

    const name = la.name.replace(/^\d{3,}\s+/, '').replace(/^[*・#]+/, '').trim();

    // 合計
    if (RE_TOTAL.test(name) && !RE_TOTAL_NG.test(name)) {
      total ??= la.amount;
      pendingName = null;
      continue;
    }

    // 値引（直前の商品から引く）
    if ((la.negative || RE_DISCOUNT.test(name)) && !/ポイント|合計|小計|預|釣/.test(name)) {
      if (items.length) items[items.length - 1].amount = Math.max(0, items[items.length - 1].amount - la.amount);
      pendingName = null;
      continue;
    }

    // 「2コX単150  300」のような数量行
    if (RE_QTY.test(name) || !hasLetter(name.replace(/単価?|個|コ|点|本|袋/g, ''))) {
      if (pendingName) items.push({ name: pendingName, amount: la.amount });
      pendingName = null;
      continue;
    }

    if (RE_NON_ITEM.test(name) || STORE_NG.test(name) || RE_ADDRESS.test(line) || !hasLetter(name)) {
      pendingName = null;
      continue;
    }
    if (la.negative) continue;

    items.push({ name, amount: la.amount });
    pendingName = null;
  }

  const isTransit = /乗車券|運賃|きっぷ|切符|普通券|回数券|特急券|乗車料金/.test(normalized);
  const transit = isTransit ? parseTransit(lines.join('\n')) : null;
  if (isTransit && items.length === 0 && total != null) items.push({ name: '運賃', amount: total });

  return {
    date: date ?? today,
    dateFound: date != null,
    storeName,
    items,
    total,
    paymentMethod: detectPaymentMethod(normalized),
    isTransit,
    transit,
  };
}
