// 음력낙서 기념일 계산: 음력·양력 기념일을 해마다 실제 날짜로 바꾸고, 명절·나이·주기·달력 파일(.ics)·공유 링크를 만든다.
// 날짜는 율리우스 일수(dn, 정수)로 다룬다. dn % 7: 0=월 … 6=일.
import { Astro, KCal } from './lunar.js';
export { KCal };

export const MIN_YEAR = 1900, MAX_YEAR = 2100;
export const WEEK = ['월', '화', '수', '목', '금', '토', '일'];
export const weekday = (dn) => ((dn % 7) + 7) % 7;
export const dn = (y, m, d) => KCal.dayNumber(y, m, d);
export const ymd = (n) => KCal.ymd(n);
export function todayDN() { const p = KCal.seoulParts(Date.now() / 1000); return dn(p.year, p.month, p.day); }

export const KINDS = {
  birthday: { label: '생일', icon: '🎂', bg: 'peach' },
  memorial: { label: '기일·제사', icon: '🕯️', bg: 'lilac' },
  anniv: { label: '기념일', icon: '💐', bg: 'pink' },
  etc: { label: '기타', icon: '📌', bg: 'sky' },
};
export const REMIND_CHOICES = [0, 1, 3, 7, 14];
export const remindLabel = (d) => (d === 0 ? '당일' : `${d}일 전`);

const STEMS = '갑을병정무기경신임계', BRANCHES = '자축인묘진사오미신유술해';
const STEMS_H = '甲乙丙丁戊己庚辛壬癸', BRANCHES_H = '子丑寅卯辰巳午未申酉戌亥';
const ANIMALS = ['쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지'];
const mod = (a, n) => ((a % n) + n) % n;
/** 음력 연도의 간지·띠 (띠는 설날 기준) */
export function ganzhiYear(y) {
  const s = mod(y - 4, 10), b = mod(y - 4, 12);
  return { hangul: STEMS[s] + BRANCHES[b], hanja: STEMS_H[s] + BRANCHES_H[b], animal: ANIMALS[b] };
}

/** 양력 dn → 음력 {year, month, day, leap} */
export const lunarOf = (n) => KCal.lunarDate(n);
export function lunarText(l, withYear = false) {
  if (!l) return '';
  return `${withYear ? l.year + '년 ' : ''}${l.leap ? '윤' : ''}${l.month}월 ${l.day}일`;
}
export const hasLeap = (y, m) => KCal.hasLeapMonth(y, m);
export const lunarMonthLength = (y, m, leap) => KCal.lunarMonthLength(y, m, leap);
/** 그 음력 해에 윤달이 있으면 몇 월인지 (없으면 0) */
export function leapMonthOf(y) { for (let m = 1; m <= 12; m++) if (KCal.hasLeapMonth(y, m)) return m; return 0; }

/**
 * 음력 y년 m월 d일이 실제로 오는 날.
 * - 윤달 기념일: 그 해에 같은 윤달이 있고 leapRule이 'leap'이면 윤달에, 아니면 평달에 (대부분의 집안 관습)
 * - 30일 기념일인데 그 달이 29일까지면 29일(그믐)로
 */
export function lunarOccurrence(y, m, d, leap = false, leapRule = 'regular') {
  if (y < MIN_YEAR || y > MAX_YEAR) return null;
  const useLeap = leap && leapRule === 'leap' && KCal.hasLeapMonth(y, m);
  const len = KCal.lunarMonthLength(y, m, useLeap);
  if (!len) return null;
  const day = Math.min(d, len);
  const n = KCal.lunarToDayNumber(y, m, day, useLeap);
  if (n == null) return null;
  return { dn: n, lunar: { year: y, month: m, day, leap: useLeap }, adjusted: day !== d ? `${m}월에 ${d}일이 없어 ${day}일(그믐)로` : (leap && !useLeap ? '윤달이 없는 해라 평달로' : '') };
}

const isLeapYear = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
export function solarOccurrence(y, m, d) {
  if (y < MIN_YEAR || y > MAX_YEAR) return null;
  if (m === 2 && d === 29 && !isLeapYear(y)) return { dn: dn(y, 2, 28), adjusted: '윤년이 아니라 2월 28일로' };
  const days = [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  if (d > days) return null;
  return { dn: dn(y, m, d), adjusted: '' };
}

// ───────── 나이·주기

const MILESTONES = { 1: '돌', 60: '환갑(회갑)', 61: '진갑', 69: '칠순(고희)', 79: '팔순(산수)', 87: '미수', 89: '구순(졸수)', 98: '백수' };
/** n번째 해가 되는 날의 설명 */
export function countLabel(kind, n) {
  if (n == null || n <= 0) return '';
  if (kind === 'birthday') return MILESTONES[n] ? `만 ${n}세 · ${MILESTONES[n]}` : `만 ${n}세`;
  if (kind === 'memorial') return `${n}주기`;
  if (kind === 'anniv') return `${n}주년`;
  return `${n}년째`;
}

// ───────── 기념일 하나의 해마다 날짜

/**
 * ev: { id, name, kind, cal:'lunar'|'solar', month, day, leap, leapRule, year|null, jesa:'day'|'eve', remind:[..], note }
 * 돌려줌: [{ dn, baseDn, lunar, adjusted, n, label, ev }]  (dn = 실제로 챙기는 날, 제사 전날 방식이면 기일 하루 전)
 */
export function occurrences(ev, from, to) {
  const out = [];
  const y0 = ymd(from)[0] - 1, y1 = ymd(to)[0] + 1;
  for (let y = Math.max(MIN_YEAR, y0); y <= Math.min(MAX_YEAR, y1); y++) {
    const o = ev.cal === 'lunar' ? lunarOccurrence(y, ev.month, ev.day, !!ev.leap, ev.leapRule) : solarOccurrence(y, ev.month, ev.day);
    if (!o) continue;
    const n = ev.year ? y - ev.year : null;
    if (n != null && n < (ev.kind === 'etc' ? 0 : 1)) continue; // 태어나기·돌아가시기 전 해는 없음
    const shift = ev.kind === 'memorial' && ev.jesa === 'eve' ? -1 : 0;
    const d = o.dn + shift;
    if (d < from || d > to) continue;
    out.push({ dn: d, baseDn: o.dn, lunar: o.lunar || lunarOf(o.dn), adjusted: o.adjusted, n, label: countLabel(ev.kind, n), ev });
  }
  return out;
}

/** 기념일의 원래 날짜 설명: "음력 3월 5일", "음력 윤4월 10일", "양력 5월 8일" */
export function sourceText(ev) {
  return `${ev.cal === 'lunar' ? '음력' : '양력'} ${ev.cal === 'lunar' && ev.leap ? '윤' : ''}${ev.month}월 ${ev.day}일`;
}

// ───────── 명절

function dongji(y) { // 동지: 태양 황경 270°가 되는 날 (한국 표준시)
  const t = Astro.solveSunLongitude(270, KCal.utcMidnight(y, 12, 21));
  const p = KCal.seoulParts(t);
  return dn(p.year, p.month, p.day);
}
const L = (m, d) => (y) => { const o = lunarOccurrence(y, m, d); return o ? o.dn : null; };
/** id, 이름, 기본 켜짐, 계산(해 → dn), 연휴 앞뒤 일수, 설명 */
export const HOLIDAYS = [
  { id: 'seollal', name: '설날', icon: '🧧', on: true, at: L(1, 1), around: 1, note: '음력 1월 1일. 앞뒤 하루가 연휴예요.' },
  { id: 'boreum', name: '정월대보름', icon: '🌕', on: true, at: L(1, 15), note: '음력 1월 15일. 부럼, 오곡밥.' },
  { id: 'hansik', name: '한식', icon: '🌱', on: false, at: (y) => dongji(y - 1) + 105, note: '동지로부터 105일째 날. 성묘하는 날.' },
  { id: 'buddha', name: '부처님오신날', icon: '🪷', on: true, at: L(4, 8), note: '음력 4월 8일. 공휴일.' },
  { id: 'dano', name: '단오', icon: '🌿', on: true, at: L(5, 5), note: '음력 5월 5일.' },
  { id: 'chilseok', name: '칠석', icon: '🌌', on: false, at: L(7, 7), note: '음력 7월 7일. 견우와 직녀.' },
  { id: 'chuseok', name: '추석', icon: '🌕', on: true, at: L(8, 15), around: 1, note: '음력 8월 15일. 앞뒤 하루가 연휴예요.' },
  { id: 'dongji', name: '동지', icon: '🥣', on: true, at: (y) => dongji(y), note: '밤이 가장 긴 날(태양 황경 270°). 팥죽.' },
];

export function holidayOccurrences(enabled, from, to) {
  const out = [];
  const y0 = ymd(from)[0] - 1, y1 = ymd(to)[0] + 1;
  for (const h of HOLIDAYS) {
    if (!enabled[h.id]) continue;
    for (let y = Math.max(MIN_YEAR + 1, y0); y <= Math.min(MAX_YEAR - 1, y1); y++) {
      const d = h.at(y);
      if (d == null || d < from || d > to) continue;
      out.push({ dn: d, holiday: h, lunar: lunarOf(d), label: h.around ? `연휴 ${ymdText(d - h.around, true)}~${ymdText(d + h.around, true)}` : '' });
    }
  }
  return out;
}

/** 명절 이름 표 (달력에 빨간 글씨로): dn → [이름…] — 연휴 앞뒤 날도 포함 */
export function holidayMap(enabled, from, to) {
  const map = new Map();
  const add = (d, s) => { if (d < from || d > to) return; if (!map.has(d)) map.set(d, []); map.get(d).push(s); };
  for (const o of holidayOccurrences(enabled, from - 3, to + 3)) {
    add(o.dn, o.holiday.name);
    if (o.holiday.around) for (let k = 1; k <= o.holiday.around; k++) { add(o.dn - k, `${o.holiday.name} 연휴`); add(o.dn + k, `${o.holiday.name} 연휴`); }
  }
  return map;
}

// ───────── 다가오는 날

/** 오늘부터 days일 안의 모든 날(기념일 + 켠 명절)을 날짜순으로 */
export function upcoming(events, enabled, from, days = 400) {
  const to = from + days;
  const list = [];
  for (const ev of events) for (const o of occurrences(ev, from, to)) list.push(o);
  for (const o of holidayOccurrences(enabled, from, to)) list.push(o);
  return list.sort((a, b) => a.dn - b.dn || (a.ev ? 0 : 1) - (b.ev ? 0 : 1));
}
export function dday(d, from) {
  const k = d - from;
  return k === 0 ? '오늘' : k === 1 ? '내일' : k === 2 ? '모레' : k > 0 ? `D-${k}` : `D+${-k}`;
}
export function ymdText(n, short = false) {
  const [y, m, d] = ymd(n);
  return short ? `${m}/${d}` : `${y}년 ${m}월 ${d}일 (${WEEK[weekday(n)]})`;
}

// ───────── 달 모양 (음력 날짜로 대략) — 0=삭, 0.5=보름

export const moonPhase = (lunarDay) => ((lunarDay - 1) + 0.5) / 29.53;

// ───────── 캘린더 파일 (.ics): 휴대폰·맥 캘린더가 대신 알려 주도록

const pad = (n) => String(n).padStart(2, '0');
const icsDate = (n) => { const [y, m, d] = ymd(n); return `${y}${pad(m)}${pad(d)}`; };
const icsEsc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
/** 75바이트(UTF-8)마다 접기 — 한글이 중간에서 잘리지 않게 */
export function foldLine(line) {
  const enc = new TextEncoder();
  const parts = []; let cur = '', bytes = 0, limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > limit) { parts.push(cur); cur = ''; bytes = 0; limit = 74; }
    cur += ch; bytes += b;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}
/** 캘린더에 보일 제목: 이름에 이미 '생신·기일' 같은 말이 있으면 덧붙이지 않음 */
export function eventTitle(ev) {
  const n = ev.name.trim();
  if (ev.kind === 'birthday') return /생일|생신/.test(n) ? n : `${n} 생일`;
  if (ev.kind === 'memorial') {
    if (ev.jesa === 'eve') return /제사/.test(n) ? `${n} (기일 전날 밤)` : `${n.replace(/\s*기일$/, '')} 제사 (기일 전날 밤)`;
    return /기일|제사/.test(n) ? n : `${n} 기일`;
  }
  return n;
}
function alarm(daysBefore, title) {
  // 종일 일정의 시작은 그날 0시. 오전 9시에 울리도록.
  const trig = daysBefore === 0 ? 'PT9H' : `-PT${daysBefore * 24 - 9}H`;
  const what = daysBefore === 0 ? '오늘' : daysBefore === 1 ? '내일' : `${daysBefore}일 뒤`;
  return ['BEGIN:VALARM', 'ACTION:DISPLAY', `TRIGGER:${trig}`, `DESCRIPTION:${icsEsc(`${what}: ${title}`)}`, 'END:VALARM'];
}
/**
 * events를 years년치 개별 일정으로 (음력은 해마다 날짜가 달라 반복 규칙으로 표현할 수 없음)
 * stamp: 'YYYYMMDDTHHMMSSZ' (테스트에서 고정하려고 인자로)
 */
export function buildICS(events, enabled, from, years = 10, includeHolidays = false, stamp = null) {
  const to = from + Math.round(years * 365.25);
  const st = stamp || new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LunarDoodle//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:음력낙서 기념일', 'X-WR-TIMEZONE:Asia/Seoul'];
  const push = (uid, d, title, desc, reminds) => {
    lines.push('BEGIN:VEVENT', `UID:${uid}@lunar-doodle`, `DTSTAMP:${st}`, `DTSTART;VALUE=DATE:${icsDate(d)}`, `DTEND;VALUE=DATE:${icsDate(d + 1)}`,
      `SUMMARY:${icsEsc(title)}`, `DESCRIPTION:${icsEsc(desc)}`, 'TRANSP:TRANSPARENT');
    for (const r of [...new Set(reminds)].sort((a, b) => b - a)) lines.push(...alarm(r, title));
    lines.push('END:VEVENT');
  };
  let count = 0;
  for (const ev of events) {
    for (const o of occurrences(ev, from, to)) {
      const k = KINDS[ev.kind] || KINDS.etc;
      const title = `${k.icon} ${eventTitle(ev)}`;
      const desc = [`${sourceText(ev)}${o.label ? ' · ' + o.label : ''}`, ev.kind === 'memorial' && ev.jesa === 'eve' ? `기일: ${ymdText(o.baseDn)}` : '', o.adjusted, ev.note || '', '음력낙서에서 만든 일정'].filter(Boolean).join('\n');
      push(`${ev.id}-${icsDate(o.dn)}`, o.dn, title, desc, ev.remind || []);
      count++;
    }
  }
  if (includeHolidays) {
    for (const o of holidayOccurrences(enabled, from, to)) {
      push(`h-${o.holiday.id}-${icsDate(o.dn)}`, o.dn, `${o.holiday.icon} ${o.holiday.name}`, `음력 ${lunarText(o.lunar)}\n${o.holiday.note}`, [o.holiday.around ? 7 : 0].filter((x) => x));
      count++;
    }
  }
  lines.push('END:VCALENDAR');
  return { text: lines.map(foldLine).join('\r\n') + '\r\n', count };
}

// ───────── 공유 링크 (#add=…): 서버를 거치지 않음. 주소의 # 뒤는 서버로 전송되지 않는다.

const SHARE_KEYS = ['name', 'kind', 'cal', 'month', 'day', 'leap', 'leapRule', 'year', 'jesa', 'remind', 'note'];
function b64url(bytes) { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unb64url(s) { const t = atob(s.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(t, (c) => c.charCodeAt(0)); }
export function encodeShare(events) {
  const slim = events.map((e) => SHARE_KEYS.map((k) => e[k] ?? null));
  return b64url(new TextEncoder().encode(JSON.stringify({ v: 1, e: slim })));
}
export function decodeShare(code) {
  const o = JSON.parse(new TextDecoder().decode(unb64url(code)));
  if (!o || o.v !== 1 || !Array.isArray(o.e)) throw new Error('알 수 없는 공유 링크예요.');
  return o.e.map((row) => { const e = {}; SHARE_KEYS.forEach((k, i) => { e[k] = row[i]; }); return sanitize(e); }).filter(Boolean);
}

/** 바깥(공유 링크·백업 파일)에서 온 기념일을 안전한 모양으로 */
export function sanitize(e) {
  if (!e || typeof e !== 'object') return null;
  const int = (v, lo, hi) => { const n = Math.trunc(Number(v)); return Number.isFinite(n) && n >= lo && n <= hi ? n : null; };
  const month = int(e.month, 1, 12), day = int(e.day, 1, e.cal === 'lunar' ? 30 : 31);
  if (!month || !day) return null;
  return {
    id: typeof e.id === 'string' && /^[a-z0-9]{6,20}$/.test(e.id) ? e.id : newId(),
    name: String(e.name || '이름 없는 날').slice(0, 40),
    kind: KINDS[e.kind] ? e.kind : 'etc',
    cal: e.cal === 'solar' ? 'solar' : 'lunar',
    month, day,
    leap: e.cal !== 'solar' && !!e.leap,
    leapRule: e.leapRule === 'leap' ? 'leap' : 'regular',
    year: int(e.year, MIN_YEAR - 100, MAX_YEAR),
    jesa: e.jesa === 'eve' ? 'eve' : 'day',
    remind: Array.isArray(e.remind) ? [...new Set(e.remind.map(Number).filter((x) => REMIND_CHOICES.includes(x)))] : [0, 1],
    note: String(e.note || '').slice(0, 200),
  };
}
export const sameEvent = (a, b) => a.name === b.name && a.cal === b.cal && a.month === b.month && a.day === b.day && !!a.leap === !!b.leap;
export function newId() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
