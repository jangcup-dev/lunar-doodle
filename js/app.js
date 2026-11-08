// 음력낙서 화면. 계산은 모두 이 기기 안에서, 기념일은 이 브라우저(localStorage)에만 저장.
import * as D from './days.js';
import * as K from './keep.js';

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem('lunar.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('lunar.' + k, JSON.stringify(v)); } catch { /* 저장 불가(사생활 보호 모드 등) */ } },
};
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const qs = new URLSearchParams(location.search);
const THIS_YEAR = D.ymd(D.todayDN())[0];

const DEMO = [
  { name: '엄마 생신', kind: 'birthday', cal: 'lunar', month: 3, day: 5, year: 1966, remind: [0, 1, 7] },
  { name: '아빠 생신', kind: 'birthday', cal: 'solar', month: 12, day: 2, year: 1963, remind: [0, 3] },
  { name: '할아버지 기일', kind: 'memorial', cal: 'lunar', month: 10, day: 3, year: 2015, jesa: 'eve', remind: [1, 7] },
  { name: '결혼기념일', kind: 'anniv', cal: 'solar', month: 5, day: 18, year: 2019, remind: [0, 7] },
].map(D.sanitize);
const defaultHolidays = () => Object.fromEntries(D.HOLIDAYS.map((h) => [h.id, h.on]));

const S = {
  events: qs.get('demo') ? DEMO : (store.get('events', []) || []).map(D.sanitize).filter(Boolean),
  holidays: Object.assign(defaultHolidays(), store.get('holidays', {})),
  section: qs.get('section') || 'list',
  month: D.ymd(D.todayDN()).slice(0, 2),
  form: null, editId: null,
  sheet: null, toast: null,
  conv: { sy: THIS_YEAR, sm: D.ymd(D.todayDN())[1], sd: D.ymd(D.todayDN())[2], ly: THIS_YEAR, lm: 1, ld: 1, ll: false },
  ics: { years: store.get('icsYears', 10), holidays: store.get('icsHol', false) },
  // 백업 상태: 마지막 백업 시각, 그 뒤로 바뀐 횟수·처음 바뀐 시각, '나중에' 누른 시각
  meta: Object.assign({ lastBackup: null, dirtyCount: 0, dirtySince: null, snoozeUntil: null }, store.get('meta', {})),
  persisted: null,
};
function saveEvents(restored = false) {
  if (qs.get('demo')) return;
  store.set('events', S.events);
  const m = S.meta;
  if (restored) Object.assign(m, { lastBackup: m.lastBackup || Date.now(), dirtyCount: 0, dirtySince: null });
  else { m.dirtyCount += 1; m.dirtySince = m.dirtySince || Date.now(); }
  store.set('meta', m);
  keepOnDevice();
}
async function keepOnDevice() { if (qs.get('demo') || !S.events.length) return; const was = S.persisted; S.persisted = await K.requestPersist(); if (was !== S.persisted && S.section === 'more' && !S.form) render(); }
/** 바뀐 게 있는데 백업이 없거나 오래됐으면 살짝 권하기: 3번 이상 바꿨거나, 처음 바꾼 지 3일이 지났을 때 */
function needBackup() {
  const m = S.meta, now = Date.now();
  if (qs.get('demo') || !S.events.length || !m.dirtyCount) return false;
  if (m.snoozeUntil && now < m.snoozeUntil) return false;
  return m.dirtyCount >= 3 || now - m.dirtySince >= 3 * K.DAY_MS || qs.get('nudge') === '1';
}
async function backup() {
  const text = JSON.stringify({ app: 'lunar-doodle', v: 1, savedAt: new Date().toISOString(), events: S.events, holidays: S.holidays }, null, 1);
  const r = await K.saveFile(`음력낙서-백업-${D.ymd(D.todayDN()).map((x) => String(x).padStart(2, '0')).join('')}.json`, text, 'application/json', '음력낙서 백업');
  if (r === 'cancelled') return;
  Object.assign(S.meta, { lastBackup: Date.now(), dirtyCount: 0, dirtySince: null, snoozeUntil: null });
  store.set('meta', S.meta); render();
  toast(r === 'shared' ? '백업 파일을 보냈어요. 카톡 나에게·드라이브 등에 잘 보관하세요' : '백업 파일을 저장했어요 (다운로드 폴더)');
}

// ───────── 작은 부품

function moon(lunarDay, size = 22) {
  const p = D.moonPhase(lunarDay), r = 10, c = 12, k = Math.cos(2 * Math.PI * p), f = (1 - k) / 2;
  const rx = Math.abs(k) * r;
  let lit = '';
  if (f > 0.97) lit = `<circle cx="${c}" cy="${c}" r="${r}" fill="var(--butter)"/>`;
  else if (f > 0.03) {
    const wax = p < 0.5, s = wax ? (k > 0 ? 0 : 1) : (k > 0 ? 1 : 0);
    lit = `<path d="M${c} ${c - r} A${r} ${r} 0 0 ${wax ? 1 : 0} ${c} ${c + r} A${rx.toFixed(2)} ${r} 0 0 ${s} ${c} ${c - r}Z" fill="var(--butter)"/>`;
  }
  return `<svg class="moon" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="${c}" cy="${c}" r="${r}" fill="var(--night)"/>${lit}<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`;
}
const kindOf = (ev) => D.KINDS[ev.kind] || D.KINDS.etc;
const opts = (list, cur, label = (v) => v) => list.map((v) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(label(v))}</option>`).join('');
const sel = (lab, field, list, cur, label, scope = 'form') => `<div class="field"><label for="f-${scope}-${field}">${lab}</label><select id="f-${scope}-${field}" data-${scope}="${field}">${opts(list, cur, label)}</select></div>`;
const seg = (field, cur, items, scope = 'form') => `<div class="seg" role="radiogroup">${items.map(([v, t]) => `<button class="${String(cur) === String(v) ? 'on' : ''}" data-act="seg" data-scope="${scope}" data-k="${field}" data-v="${v}" role="radio" aria-checked="${String(cur) === String(v)}">${t}</button>`).join('')}</div>`;
const monthDays = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

function itemRow(o, from) {
  const d = o.dn - from, soon = d <= 7;
  const [, m, day] = D.ymd(o.dn);
  const when = `${m}/${day} (${D.WEEK[D.weekday(o.dn)]})`;
  if (o.holiday) {
    return `<button class="item hol" data-act="hol" data-id="${o.holiday.id}" data-dn="${o.dn}">
      <span class="ic">${o.holiday.icon}</span><span class="grow"><span class="nm hl">${esc(o.holiday.name)}</span><span class="sub">음력 ${esc(D.lunarText(o.lunar))}${o.label ? ' · ' + esc(o.label) : ''}</span></span>
      <span class="when"><b class="hand">${D.dday(o.dn, from)}</b><span>${when}</span></span></button>`;
  }
  const k = kindOf(o.ev);
  const what = o.ev.kind === 'memorial' ? (o.ev.jesa === 'eve' ? '제사 (기일 전날 밤)' : '기일') : '';
  const sub = [D.sourceText(o.ev), o.label, what, o.adjusted].filter(Boolean).join(' · ');
  return `<button class="st item ${soon ? 'soon' : ''} ${d === 0 ? 'is-today' : ''}" data-act="ev" data-id="${o.ev.id}">
    <span class="badge bg-${k.bg}">${k.icon}</span><span class="grow"><span class="nm">${esc(o.ev.name)}</span><span class="sub">${esc(sub)}</span></span>
    <span class="when"><b class="hand">${D.dday(o.dn, from)}</b><span>${when}</span></span></button>`;
}

// ───────── 다가오는 날

function renderList() {
  const from = D.todayDN(), l = D.lunarOf(from), gz = D.ganzhiYear(l.year);
  const list = D.upcoming(S.events, S.holidays, from, 366);
  let html = `<section class="st w2 todaycard"><div class="row">${moon(l.day, 46)}<div class="grow">
      <div class="small soft">오늘 · ${esc(D.ymdText(from))}</div>
      <div class="hand big">음력 ${esc(D.lunarText(l))}</div>
      <div class="small soft">${gz.hangul}(${gz.hanja})년 · ${gz.animal}띠 해${D.leapMonthOf(l.year) ? ` · 올해는 윤${D.leapMonthOf(l.year)}월이 있어요` : ''}</div></div></div></section>`;
  const soon = list.filter((o) => o.ev && o.dn - from <= 1);
  if (soon.length) html += `<section class="st alert bg-pink pastel"><b class="hand" style="font-size:24px">잊지 마세요!</b><div>${soon.map((o) => `${esc(o.ev.name)} ${o.dn === from ? '오늘' : '내일'}`).join(', ')}</div></section>`;
  if (needBackup()) {
    html += `<section class="st nudge bg-mint pastel"><div class="row"><span style="font-size:26px">💾</span><div class="grow"><b class="hand" style="font-size:23px">백업해 둘까요?</b>
      <div class="small">기념일은 이 폰 브라우저에만 있어요. ${S.meta.lastBackup ? `마지막 백업은 ${K.agoText(S.meta.lastBackup)}이고, 그 뒤로 ${S.meta.dirtyCount}번 바뀌었어요.` : '아직 한 번도 백업하지 않았어요.'} 파일을 카톡 ‘나에게’나 드라이브에 두면 폰을 바꿔도 되살릴 수 있어요.</div></div></div>
      <div class="row" style="margin-top:8px"><span class="grow"></span><button class="link" data-act="snooze">나중에</button><button class="st btn bg-card" data-act="backup">백업하기</button></div></section>`;
  }
  if (!S.events.length) {
    html += `<section class="st w3 empty"><div class="hand" style="font-size:26px">아직 등록한 날이 없어요</div>
      <p class="small soft">음력 생신이나 제사처럼 해마다 날짜가 바뀌는 날을 등록하면, 올해는 양력 며칠인지 알아서 계산해 드려요.</p>
      <div class="sugg">${[['엄마 생신', 'birthday'], ['아빠 생신', 'birthday'], ['할머니 생신', 'birthday'], ['할아버지 기일', 'memorial'], ['내 음력 생일', 'birthday']].map(([n, k]) => `<button class="chip bg-${D.KINDS[k].bg}" data-act="new" data-name="${n}" data-kind="${k}">+ ${n}</button>`).join('')}</div></section>`;
  }
  let cur = '';
  for (const o of list) {
    const [y, m] = D.ymd(o.dn), key = `${y}-${m}`;
    if (key !== cur) { html += `<h3 class="mh hand">${y === THIS_YEAR ? '' : y + '년 '}${m}월</h3>`; cur = key; }
    html += itemRow(o, from);
  }
  html += `<p class="tiny soft center" style="margin-top:20px">앞으로 1년 동안의 날이에요. 명절은 ‘더보기’에서 켜고 끌 수 있어요.</p>`;
  return `<div class="gap">${html}</div><button class="st fab" data-act="new" aria-label="기념일 추가">＋ 추가</button>`;
}

// ───────── 달력

function renderCalendar() {
  const [y, m] = S.month, first = D.dn(y, m, 1), days = monthDays(y, m), from = D.todayDN();
  const lead = (D.weekday(first) + 1) % 7; // 일요일 시작
  const evs = new Map();
  for (const ev of S.events) for (const o of D.occurrences(ev, first, first + days - 1)) { if (!evs.has(o.dn)) evs.set(o.dn, []); evs.get(o.dn).push(o); }
  const hol = D.holidayMap(S.holidays, first, first + days - 1);
  let cells = '';
  for (let i = 0; i < lead; i++) cells += '<div></div>';
  for (let d = 1; d <= days; d++) {
    const n = first + d - 1, l = D.lunarOf(n), wd = (D.weekday(n) + 1) % 7, h = hol.get(n), e = evs.get(n) || [];
    const lt = l.day === 1 ? `${l.leap ? '윤' : ''}${l.month}.1` : String(l.day);
    cells += `<button class="cell ${n === from ? 'today' : ''} ${e.length ? 'has' : ''}" data-act="cday" data-dn="${n}" aria-label="${m}월 ${d}일, 음력 ${esc(D.lunarText(l))}${h ? ', ' + esc(h.join(', ')) : ''}${e.length ? ', ' + esc(e.map((o) => o.ev.name).join(', ')) : ''}">
      <span class="n ${wd === 0 || h ? 'hl' : wd === 6 ? 'sat' : ''}">${d}</span><span class="lu ${l.day === 1 || l.day === 15 ? 'key' : ''}">${lt}</span>
      ${h ? `<span class="hn">${esc(h[0].replace(' 연휴', ''))}</span>` : ''}${e.length ? `<span class="em">${e.slice(0, 2).map((o) => kindOf(o.ev).icon).join('')}</span>` : ''}</button>`;
  }
  const l1 = D.lunarOf(first), l2 = D.lunarOf(first + days - 1);
  return `<div class="gap"><section class="st cal" id="swipe-cal">
    <div class="row calhead"><button class="iconbtn" data-act="month" data-n="-1" aria-label="이전 달"><span class="st flat">‹</span></button>
      <div class="grow center"><div class="hand" style="font-size:30px">${y}년 ${m}월</div><div class="tiny soft">음력 ${esc(D.lunarText(l1))} ~ ${esc(D.lunarText(l2))}</div></div>
      <button class="iconbtn" data-act="month" data-n="1" aria-label="다음 달"><span class="st flat">›</span></button></div>
    <div class="cgrid">${['일', '월', '화', '수', '목', '금', '토'].map((w, i) => `<div class="wh ${i === 0 ? 'hl' : i === 6 ? 'sat' : ''}">${w}</div>`).join('')}${cells}</div></section>
    ${S.month[0] !== THIS_YEAR || S.month[1] !== D.ymd(from)[1] ? '<button class="st back-today" data-act="thismonth">이번 달로</button>' : ''}
    <p class="tiny soft center">작은 숫자는 음력 날짜예요. 음력 초하루는 ‘월.1’로 보여요. 날짜를 누르면 자세히 볼 수 있어요.</p></div>`;
}

// ───────── 변환

function renderConvert() {
  const c = S.conv;
  const sdays = monthDays(c.sy, c.sm), sd = Math.min(c.sd, sdays);
  const sdn = D.dn(c.sy, c.sm, sd), sl = D.lunarOf(sdn), sgz = D.ganzhiYear(sl.year);
  const leapOk = D.hasLeap(c.ly, c.lm), ll = c.ll && leapOk;
  const llen = D.lunarMonthLength(c.ly, c.lm, ll) || 30;
  const lo = D.lunarOccurrence(c.ly, c.lm, Math.min(c.ld, llen), ll, 'leap');
  const lgz = D.ganzhiYear(c.ly), leapM = D.leapMonthOf(c.ly);
  const years = range(D.MIN_YEAR + 1, D.MAX_YEAR - 1).reverse();
  return `<div class="gap">
    <section class="st form"><div class="hand" style="font-size:26px">양력 → 음력</div>
      <div class="g3">${sel('년', 'sy', years, c.sy, (v) => v + '년', 'conv')}${sel('월', 'sm', range(1, 12), c.sm, (v) => v + '월', 'conv')}${sel('일', 'sd', range(1, sdays), sd, (v) => v + '일', 'conv')}</div>
      <div class="result bg-butter pastel st flat thin"><div class="row">${moon(sl.day, 34)}<div class="grow"><div class="hand" style="font-size:28px">음력 ${esc(D.lunarText(sl, true))}</div>
        <div class="small">${sgz.hangul}(${sgz.hanja})년 · ${sgz.animal}띠 · ${D.WEEK[D.weekday(sdn)]}요일</div></div></div></div>
      <div class="row"><span class="grow"></span><button class="link" data-act="new-from" data-cal="lunar" data-y="${sl.year}" data-m="${sl.month}" data-d="${sl.day}" data-l="${sl.leap ? 1 : 0}">이 음력 날짜로 기념일 만들기 →</button></div></section>
    <section class="st w2 form"><div class="hand" style="font-size:26px">음력 → 양력</div>
      <div class="g3">${sel('년', 'ly', years, c.ly, (v) => v + '년', 'conv')}${sel('월', 'lm', range(1, 12), c.lm, (v) => v + '월', 'conv')}${sel('일', 'ld', range(1, 30), c.ld, (v) => v + '일', 'conv')}</div>
      <label class="switch"><span class="grow">윤달<span class="tiny soft"> · ${leapM ? `${c.ly}년에는 윤${leapM}월이 있어요` : `${c.ly}년에는 윤달이 없어요`}</span></span><input type="checkbox" data-conv="ll" ${ll ? 'checked' : ''} ${leapOk ? '' : 'disabled'}></label>
      ${lo ? `<div class="result bg-sky pastel st flat thin"><div class="hand" style="font-size:28px">양력 ${esc(D.ymdText(lo.dn))}</div>
        <div class="small">${lgz.hangul}(${lgz.hanja})년 ${ll ? '윤' : ''}${c.lm}월은 ${llen}일까지${c.ld > llen ? ` · ${c.ld}일이 없어 그믐(${llen}일)로 보여 드려요` : ''}</div></div>` : '<div class="small hl">이 범위의 날짜는 계산할 수 없어요.</div>'}</section>
    <p class="tiny soft">음력은 한국천문연구원과 같은 방식(서울 기준 삭·중기)으로 천문 계산해요. 1901–2099년의 모든 날을 양↔음 왕복 검사했고, 2000–2030년 설날·추석이 공식 날짜와 같아요. 띠·간지는 설날 기준이에요.</p></div>`;
}

// ───────── 더보기 (명절 · 캘린더 알림 · 공유 · 백업)

function renderMore() {
  const n = S.events.length;
  return `<div class="gap">
    <section class="st form"><div class="hand" style="font-size:26px">📅 휴대폰 캘린더로 알림 받기</div>
      <p class="small">웹앱은 꺼져 있을 때 알림을 보낼 수 없어서, 기념일을 <b>캘린더 파일</b>로 만들어 휴대폰 캘린더에 넣는 방식을 써요. 음력 날짜는 해마다 바뀌므로 몇 년치를 미리 계산해 넣어요. 알림은 각 기념일에 정한 날 오전 9시에 울려요.</p>
      <div class="g2">${sel('기간', 'years', [3, 5, 10, 20], S.ics.years, (v) => `앞으로 ${v}년`, 'ics')}<label class="switch"><span class="grow small">명절도 함께</span><input type="checkbox" data-ics="holidays" ${S.ics.holidays ? 'checked' : ''}></label></div>
      <button class="st btn" data-act="ics" ${n ? '' : 'disabled'}>캘린더 파일 받기 (.ics)</button>
      <details class="small"><summary>휴대폰에 넣는 방법</summary>
        <p><b>갤럭시:</b> 받은 파일(내 파일 → 다운로드)을 눌러 <b>삼성 캘린더</b>로 열고 ‘저장’을 눌러요. 구글 캘린더만 쓰면 컴퓨터에서 calendar.google.com → 설정 → 가져오기로 넣어요.</p>
        <p><b>아이폰:</b> 사파리에서 버튼을 누르면 ‘모두 추가’가 떠요. 안 뜨면 파일 앱의 다운로드에서 파일을 눌러요.</p>
        <p><b>맥:</b> 파일을 두 번 누르면 캘린더 앱에 들어가요.</p>
        <p>기념일을 고친 뒤 다시 넣으면 같은 일정은 덮어써지는 캘린더가 많지만, 겹쳐 보이면 예전 일정을 지워 주세요.</p></details></section>
    <section class="st w2 form"><div class="hand" style="font-size:26px">💌 가족에게 보내기</div>
      <p class="small">고른 기념일을 링크 하나로 보내요. 받은 사람이 링크를 열면 자기 휴대폰에 그대로 추가돼요. 정보는 링크 안에만 담기고 어떤 서버에도 저장되지 않아요.</p>
      <button class="st btn bg-pink" data-act="share-pick" ${n ? '' : 'disabled'}>보낼 기념일 고르기</button></section>
    <section class="st w3 form"><div class="hand" style="font-size:26px">🏮 명절 표시</div>
      ${D.HOLIDAYS.map((h) => `<label class="switch"><span class="grow">${h.icon} ${h.name}<span class="tiny soft"> · ${esc(h.note)}</span></span><input type="checkbox" data-hol="${h.id}" ${S.holidays[h.id] ? 'checked' : ''}></label>`).join('')}</section>
    <section class="st form"><div class="hand" style="font-size:26px">💾 백업</div>
      <p class="small">기념일은 이 브라우저에만 저장돼요. 브라우저 기록을 지우거나 휴대폰을 바꾸기 전에 백업 파일을 저장해 두세요. 휴대폰에서는 공유 창이 열리니 카톡 ‘나에게’나 드라이브에 보내 두면 편해요.</p>
      <div class="kv small"><span>마지막 백업</span><b>${S.meta.lastBackup ? `${new Date(S.meta.lastBackup).toLocaleDateString('ko-KR')} (${K.agoText(S.meta.lastBackup)})${S.meta.dirtyCount ? ` · 그 뒤 ${S.meta.dirtyCount}번 바뀜` : ' · 최신'}` : '아직 없음'}</b></div>
      <div class="kv small"><span>이 기기에 오래 보관</span><b>${S.persisted === true ? '켜짐 — 저장 공간이 부족해도 지우지 않아요' : S.persisted === false ? '브라우저가 아직 허락하지 않았어요 (홈 화면에 추가하면 허락되는 경우가 많아요)' : '이 브라우저는 지원하지 않아요'}</b></div>
      <div class="row wrap"><button class="st btn bg-mint" data-act="backup" ${n ? '' : 'disabled'}>백업 파일 저장</button><label class="st btn bg-sky filebtn">백업 불러오기<input type="file" accept=".json,application/json" data-act-file="restore" hidden></label></div>
      ${n ? `<div class="row"><span class="grow"></span><button class="link hl" data-act="wipe">기념일 ${n}개 모두 지우기</button></div>` : ''}</section>
    <p class="small soft">🔒 계산은 모두 이 기기 안에서 하고, 입력한 기념일은 이 브라우저에만 저장돼요. 인터넷이 없어도 열려요.</p></div>`;
}

// ───────── 기념일 입력

function blankForm(o = {}) {
  return Object.assign({ name: '', kind: 'birthday', cal: 'lunar', month: 1, day: 1, leap: false, leapRule: 'regular', year: null, jesa: 'day', remind: [0, 1], note: '' }, o);
}
const YEAR_LABEL = { birthday: '태어난 해', memorial: '돌아가신 해', anniv: '시작한 해', etc: '처음 해' };

function renderForm() {
  const f = S.form, isL = f.cal === 'lunar', from = D.todayDN();
  const maxDay = isL ? 30 : (f.month === 2 ? 29 : monthDays(2024, f.month));
  if (f.day > maxDay) f.day = maxDay;
  const leapM = f.year ? D.leapMonthOf(f.year) : 0;
  const leapOk = isL && (!f.year || leapM === f.month);
  if (!leapOk) f.leap = false;
  // 그때의 반대쪽 날짜 (태어난 해를 알 때)
  let other = '';
  if (f.year && f.year >= D.MIN_YEAR && f.year <= D.MAX_YEAR) {
    if (isL) {
      const o = D.lunarOccurrence(f.year, f.month, f.day, f.leap, 'leap');
      if (o) other = `<div class="tiny soft">그때 양력으로는 ${esc(D.ymdText(o.dn))}${o.adjusted && f.day > 29 ? ' (그 해 ' + f.month + '월은 29일까지)' : ''}</div>`;
    } else {
      const o = D.solarOccurrence(f.year, f.month, f.day);
      if (o && !o.adjusted) { const l = D.lunarOf(o.dn); other = `<div class="row tiny soft"><span class="grow">그때 음력으로는 ${esc(D.lunarText(l, true))}</span><button class="link small" data-act="to-lunar" data-m="${l.month}" data-d="${l.day}" data-l="${l.leap ? 1 : 0}" data-y="${l.year}">음력으로 챙길래요</button></div>`; }
    }
  }
  const preview = D.occurrences(D.sanitize({ ...f, name: '미리보기' }), from, from + 365 * 3 + 2).slice(0, 3);
  const yrs = [['', '모름 · 없음'], ...range(1900, THIS_YEAR + 5).reverse().map((v) => [v, v + '년'])];
  return `<div class="gap">
    <div class="row"><button class="link" data-act="cancel">‹ 돌아가기</button><span class="grow"></span></div>
    <section class="st form"><div class="hand" style="font-size:28px">${S.editId ? '기념일 고치기' : '새 기념일'}</div>
      <div class="field"><label for="f-name">이름</label><input id="f-name" data-form="name" value="${esc(f.name)}" placeholder="예: 엄마 생신, 할아버지 기일" maxlength="40" autocomplete="off"></div>
      ${seg('kind', f.kind, Object.entries(D.KINDS).map(([k, v]) => [k, `${v.icon} ${v.label}`]))}</section>
    <section class="st w2 form"><div class="hand" style="font-size:24px">날짜</div>
      <div class="row"><span class="grow">달력</span>${seg('cal', f.cal, [['lunar', '음력'], ['solar', '양력']])}</div>
      <div class="g3">${`<div class="field"><label for="f-form-year">${YEAR_LABEL[f.kind]}</label><select id="f-form-year" data-form="year">${yrs.map(([v, t]) => `<option value="${v}" ${String(f.year ?? '') === String(v) ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`}
        ${sel('월', 'month', range(1, 12), f.month, (v) => v + '월')}${sel('일', 'day', range(1, maxDay), f.day, (v) => v + '일')}</div>
      ${other}
      ${isL ? `<label class="switch"><span class="grow">윤달<span class="tiny soft"> · ${f.year ? (leapM ? `${f.year}년에는 윤${leapM}월이 있었어요` : `${f.year}년에는 윤달이 없었어요`) : '윤달에 태어났거나 돌아가셨다면'}</span></span><input type="checkbox" data-form="leap" ${f.leap ? 'checked' : ''} ${leapOk ? '' : 'disabled'}></label>` : ''}
      ${f.leap ? sel('윤달이 아닌 해에는', 'leapRule', ['regular', 'leap'], f.leapRule, (v) => (v === 'regular' ? '해마다 평달(같은 달)에 챙겨요 — 대부분' : '그 해에 같은 윤달이 있으면 윤달에, 없으면 평달에')) : ''}
      ${f.kind === 'memorial' ? `<div class="col" style="gap:4px"><span>제사 지내는 날</span>${seg('jesa', f.jesa, [['day', '기일 당일 저녁'], ['eve', '기일 전날 밤']])}<span class="tiny soft">예전에는 돌아가신 날 첫 시각(자시)에 지내려고 전날 밤에 지냈고, 요즘은 기일 당일 저녁에 지내는 집이 많아요.</span></div>` : ''}
      <p class="tiny soft">${isL ? '음력 30일이 없는 해에는 29일(그믐)로 챙겨요.' : '2월 29일은 윤년이 아닌 해에 2월 28일로 챙겨요.'}</p></section>
    <section class="st w3 form"><div class="hand" style="font-size:24px">알림</div>
      <div class="sugg">${D.REMIND_CHOICES.map((r) => `<button class="chip ${f.remind.includes(r) ? 'bg-butter on' : ''}" data-act="remind" data-r="${r}" aria-pressed="${f.remind.includes(r)}">${f.remind.includes(r) ? '✓ ' : ''}${D.remindLabel(r)}</button>`).join('')}</div>
      <p class="tiny soft">휴대폰 캘린더에 넣으면 이 때 알려 줘요 (더보기 → 캘린더로 알림 받기).</p>
      <div class="field"><label for="f-note">메모 (선택)</label><input id="f-note" data-form="note" value="${esc(f.note)}" placeholder="예: 미역국, 꽃 사기" maxlength="200" autocomplete="off"></div></section>
    ${preview.length ? `<section class="st flat thin preview"><div class="small soft">다음에 오는 날</div>${preview.map((o) => `<div class="row"><b class="hand" style="font-size:22px;width:64px">${D.dday(o.dn, from)}</b><span class="grow">${esc(D.ymdText(o.dn))}<span class="tiny soft">${o.label ? ' · ' + esc(o.label) : ''}${o.adjusted ? ' · ' + esc(o.adjusted) : ''}${o.ev.kind === 'memorial' && o.ev.jesa === 'eve' ? ' · 기일 ' + esc(D.ymdText(o.baseDn)) : ''}</span></span></div>`).join('')}</section>` : ''}
    <div class="row"><span class="grow"></span><button class="link" data-act="cancel">취소</button><button class="st btn" data-act="save">${S.editId ? '저장' : '추가'}</button></div></div>`;
}

// ───────── 시트 (아래에서 올라오는 창)

function eventSheet(id) {
  const ev = S.events.find((e) => e.id === id); if (!ev) return;
  const from = D.todayDN(), k = kindOf(ev);
  const occ = D.occurrences(ev, from, from + 365 * 6).slice(0, 6);
  S.sheet = { title: `${k.icon} ${ev.name}`, html: `
    <div class="small soft">${esc(k.label)} · ${esc(D.sourceText(ev))}${ev.year ? ` · ${ev.year}년` : ''}${ev.leap ? (ev.leapRule === 'leap' ? ' · 윤달 있는 해엔 윤달에' : ' · 평달에 챙김') : ''}</div>
    ${ev.note ? `<p class="small">📝 ${esc(ev.note)}</p>` : ''}
    <table class="yt">${occ.map((o) => `<tr><td class="hand">${D.dday(o.dn, from)}</td><td>${esc(D.ymdText(o.dn))}${o.ev.kind === 'memorial' && ev.jesa === 'eve' ? `<div class="tiny soft">기일 ${esc(D.ymdText(o.baseDn))}</div>` : ''}</td><td class="tiny soft">${esc(o.label)}${o.adjusted ? `<br>${esc(o.adjusted)}` : ''}</td></tr>`).join('')}</table>
    <div class="small soft">알림: ${ev.remind.length ? ev.remind.slice().sort((a, b) => a - b).map(D.remindLabel).join(', ') : '없음'}</div>
    <div class="row wrap" style="margin-top:14px"><button class="link hl" data-act="del" data-id="${ev.id}">삭제</button><span class="grow"></span><button class="link" data-act="share-one" data-id="${ev.id}">보내기</button><button class="st btn" data-act="edit" data-id="${ev.id}">고치기</button></div>` };
}
function holidaySheet(hid, n) {
  const h = D.HOLIDAYS.find((x) => x.id === hid); const from = D.todayDN();
  const occ = D.holidayOccurrences({ [hid]: true }, from, from + 365 * 5 + 30).slice(0, 5);
  S.sheet = { title: `${h.icon} ${h.name}`, html: `<p class="small">${esc(h.note)}</p><table class="yt">${occ.map((o) => `<tr><td class="hand">${D.dday(o.dn, from)}</td><td>${esc(D.ymdText(o.dn))}</td><td class="tiny soft">${esc(o.label)}</td></tr>`).join('')}</table>` };
}
function daySheet(n) {
  const from = D.todayDN(), l = D.lunarOf(n), gz = D.ganzhiYear(l.year);
  const evs = S.events.flatMap((ev) => D.occurrences(ev, n, n));
  const hol = D.holidayMap(S.holidays, n, n).get(n) || [];
  S.sheet = { title: D.ymdText(n), html: `
    <div class="row">${moon(l.day, 40)}<div class="grow"><div class="hand" style="font-size:24px">음력 ${esc(D.lunarText(l, true))}</div><div class="small soft">${gz.hangul}(${gz.hanja})년 · ${gz.animal}띠 · ${D.dday(n, from)}</div></div></div>
    ${hol.length ? `<p class="hl">${hol.map(esc).join(', ')}</p>` : ''}
    ${evs.map((o) => `<button class="st item" data-act="ev" data-id="${o.ev.id}"><span class="badge bg-${kindOf(o.ev).bg}">${kindOf(o.ev).icon}</span><span class="grow"><span class="nm">${esc(o.ev.name)}</span><span class="sub">${esc([D.sourceText(o.ev), o.label].filter(Boolean).join(' · '))}</span></span></button>`).join('')}
    <div class="row" style="margin-top:12px"><span class="grow"></span><button class="link" data-act="new-from" data-cal="solar" data-y="${D.ymd(n)[0]}" data-m="${D.ymd(n)[1]}" data-d="${D.ymd(n)[2]}">양력으로 추가</button><button class="st btn" data-act="new-from" data-cal="lunar" data-y="${l.year}" data-m="${l.month}" data-d="${l.day}" data-l="${l.leap ? 1 : 0}">음력 ${esc(D.lunarText(l))}로 추가</button></div>` };
}
function sharePickSheet(ids) {
  S.sheet = { title: '보낼 기념일', share: new Set(ids || S.events.map((e) => e.id)), html: '' };
  S.sheet.render = () => `<p class="small soft">받는 사람의 휴대폰에서 링크를 열면 추가할지 물어봐요.</p>
    ${S.events.map((e) => `<label class="switch"><span class="grow">${kindOf(e).icon} ${esc(e.name)} <span class="tiny soft">${esc(D.sourceText(e))}</span></span><input type="checkbox" data-share="${e.id}" ${S.sheet.share.has(e.id) ? 'checked' : ''}></label>`).join('')}
    <div class="row" style="margin-top:12px"><span class="grow"></span><button class="st btn bg-pink" data-act="share-go" ${S.sheet.share.size ? '' : 'disabled'}>${S.sheet.share.size}개 링크 만들기</button></div>`;
}
function importSheet(list) {
  const fresh = list.filter((e) => !S.events.some((x) => D.sameEvent(x, e)));
  S.sheet = { title: '💌 받은 기념일', pick: new Set(fresh.map((e) => e.id)), incoming: list, html: '' };
  S.sheet.render = () => `<p class="small">${S.sheet.restore ? `백업 파일에 기념일 ${list.length}개가 있어요. 되살릴 것을 골라 주세요.` : `누군가 기념일 ${list.length}개를 보냈어요. 추가할 것을 골라 주세요.`}</p>
    ${list.map((e) => { const dup = !fresh.includes(e); return `<label class="switch"><span class="grow">${kindOf(e).icon} ${esc(e.name)} <span class="tiny soft">${esc(D.sourceText(e))}${e.year ? ' · ' + e.year + '년' : ''}${dup ? ' · 이미 있어요' : ''}</span></span><input type="checkbox" data-pick="${e.id}" ${S.sheet.pick.has(e.id) ? 'checked' : ''} ${dup ? 'disabled' : ''}></label>`; }).join('')}
    <div class="row" style="margin-top:12px"><span class="grow"></span><button class="link" data-act="close-sheet">안 할래요</button><button class="st btn" data-act="import-go" ${S.sheet.pick.size ? '' : 'disabled'}>${S.sheet.pick.size}개 추가</button></div>`;
}

// ───────── 그리기

const TABS = [['list', '다가오는 날', 'butter'], ['calendar', '달력', 'mint'], ['convert', '변환', 'sky'], ['more', '더보기', 'lilac']];
function render() {
  const inForm = !!S.form;
  const body = inForm ? renderForm() : { list: renderList, calendar: renderCalendar, convert: renderConvert, more: renderMore }[S.section]();
  const sheetHtml = S.sheet ? (S.sheet.render ? S.sheet.render() : S.sheet.html) : '';
  const focus = document.activeElement && document.activeElement.id;
  $('#app').innerHTML = `
    <header class="top"><div class="bar"><span class="brand hand">음력낙서 ☾</span><span class="grow"></span></div>
      ${inForm ? '' : `<nav class="st tabs" role="tablist">${TABS.map(([k, t, bg]) => `<button class="tab ${S.section === k ? 'on' : ''}" style="${S.section === k ? `background:var(--${bg})` : ''}" data-act="tab" data-k="${k}" role="tab" aria-selected="${S.section === k}">${t}</button>`).join('')}</nav>`}
    </header>
    <main>${body}</main>
    ${S.sheet ? `<div class="sheet-bg" data-act="close"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(S.sheet.title)}"><div class="grab"></div><div class="hand" style="font-size:28px">${esc(S.sheet.title)}</div><div class="sbody">${sheetHtml}</div></div></div>` : ''}
    ${S.toast ? `<div class="toast st" role="status">${esc(S.toast)}</div>` : ''}`;
  if (focus && (focus === 'f-name' || focus === 'f-note')) { const el = document.getElementById(focus); if (el) { el.focus(); const v = el.value; el.setSelectionRange(v.length, v.length); } }
  bindSwipe('#swipe-cal', (dir) => moveMonth(dir));
}
let toastTimer;
function toast(t) { S.toast = t; render(); clearTimeout(toastTimer); toastTimer = setTimeout(() => { S.toast = null; render(); }, 2600); }
function moveMonth(n) { let [y, m] = S.month; m += n; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } if (y <= D.MIN_YEAR || y >= D.MAX_YEAR) return; S.month = [y, m]; render(); }
function bindSwipe(selr, cb) {
  const el = $(selr); if (!el) return;
  let x0 = null, y0 = null;
  el.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) cb(dx < 0 ? 1 : -1);
  }, { passive: true });
}

const download = K.download;
async function shareLink(events) {
  const url = `${location.origin}${location.pathname}#add=${D.encodeShare(events)}`;
  const text = `음력낙서 기념일 ${events.length}개: ${events.map((e) => e.name).join(', ')}`;
  if (navigator.share) { try { await navigator.share({ title: '음력낙서 기념일', text, url }); S.sheet = null; render(); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(url); S.sheet = null; toast('링크를 복사했어요. 카톡에 붙여 넣어 보내세요.'); }
  catch { S.sheet = { title: '링크', html: `<p class="small">아래 링크를 길게 눌러 복사해 보내 주세요.</p><textarea class="field" style="width:100%;height:120px" readonly>${esc(url)}</textarea>` }; render(); }
}
function openForm(o, id = null) { S.form = blankForm(o); S.editId = id; S.sheet = null; render(); scrollTo(0, 0); }

// ───────── 입력 처리

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-act]'); if (!t) return;
  const act = t.dataset.act;
  if (act === 'close') { if (e.target === t) { S.sheet = null; render(); } return; }
  if (act === 'close-sheet') { S.sheet = null; render(); }
  else if (act === 'tab') { S.section = t.dataset.k; render(); scrollTo(0, 0); }
  else if (act === 'month') moveMonth(+t.dataset.n);
  else if (act === 'thismonth') { S.month = D.ymd(D.todayDN()).slice(0, 2); render(); }
  else if (act === 'ev') { eventSheet(t.dataset.id); render(); }
  else if (act === 'hol') { holidaySheet(t.dataset.id, +t.dataset.dn); render(); }
  else if (act === 'cday') { daySheet(+t.dataset.dn); render(); }
  else if (act === 'new') openForm({ name: t.dataset.name && !t.dataset.name.startsWith('내 ') ? t.dataset.name : (t.dataset.name ? '내 생일' : ''), kind: t.dataset.kind || 'birthday' });
  else if (act === 'new-from') openForm({ cal: t.dataset.cal, month: +t.dataset.m, day: +t.dataset.d, leap: t.dataset.l === '1', year: +t.dataset.y, kind: 'etc' });
  else if (act === 'edit') { const ev = S.events.find((x) => x.id === t.dataset.id); if (ev) openForm({ ...ev, remind: [...ev.remind] }, ev.id); }
  else if (act === 'cancel') { S.form = null; S.editId = null; render(); }
  else if (act === 'seg') {
    const tgt = t.dataset.scope === 'form' ? S.form : null; if (!tgt) return;
    tgt[t.dataset.k] = t.dataset.v;
    if (t.dataset.k === 'cal') tgt.leap = false;
    render();
  } else if (act === 'remind') { const r = +t.dataset.r, f = S.form; f.remind = f.remind.includes(r) ? f.remind.filter((x) => x !== r) : [...f.remind, r]; render(); }
  else if (act === 'to-lunar') { Object.assign(S.form, { cal: 'lunar', month: +t.dataset.m, day: +t.dataset.d, leap: t.dataset.l === '1', year: +t.dataset.y }); render(); }
  else if (act === 'save') {
    const f = S.form;
    if (!f.name.trim()) { toast('이름을 적어 주세요'); document.getElementById('f-name')?.focus(); return; }
    const ev = D.sanitize({ ...f, name: f.name.trim(), id: S.editId || undefined });
    if (S.editId) S.events = S.events.map((x) => (x.id === S.editId ? ev : x)); else S.events.push(ev);
    saveEvents(); S.form = null; S.editId = null; S.section = 'list'; render(); scrollTo(0, 0); toast(`‘${ev.name}’ 저장했어요`);
  } else if (act === 'del') {
    const ev = S.events.find((x) => x.id === t.dataset.id);
    if (ev && confirm(`‘${ev.name}’을(를) 지울까요?`)) { S.events = S.events.filter((x) => x.id !== ev.id); saveEvents(); S.sheet = null; render(); toast('지웠어요'); }
  } else if (act === 'share-pick') { sharePickSheet(); render(); }
  else if (act === 'share-one') { const ev = S.events.find((x) => x.id === t.dataset.id); if (ev) shareLink([ev]); }
  else if (act === 'share-go') shareLink(S.events.filter((x) => S.sheet.share.has(x.id)));
  else if (act === 'import-go') {
    const add = S.sheet.incoming.filter((x) => S.sheet.pick.has(x.id)).map((x) => ({ ...x, id: D.newId() }));
    S.events.push(...add); saveEvents(!!S.sheet.restore); S.sheet = null; S.section = 'list'; render(); toast(`${add.length}개 추가했어요`);
  } else if (act === 'ics') {
    const { text, count } = D.buildICS(S.events, S.holidays, D.todayDN(), S.ics.years, S.ics.holidays);
    download('음력낙서-기념일.ics', text, 'text/calendar;charset=utf-8'); toast(`일정 ${count}개를 담은 파일을 받았어요`);
  } else if (act === 'backup') backup();
  else if (act === 'snooze') { S.meta.snoozeUntil = Date.now() + 7 * K.DAY_MS; store.set('meta', S.meta); render(); toast('일주일 뒤에 다시 알려 드릴게요');
  } else if (act === 'wipe') {
    if (confirm(`기념일 ${S.events.length}개를 모두 지울까요? 백업 파일이 없으면 되돌릴 수 없어요.`)) { S.events = []; saveEvents(); render(); }
  }
});

document.addEventListener('change', (e) => {
  const el = e.target, v = el.type === 'checkbox' ? el.checked : el.value;
  if (el.dataset.form && S.form) {
    const k = el.dataset.form;
    if (k === 'year') S.form.year = v === '' ? null : +v;
    else if (k === 'month' || k === 'day') S.form[k] = +v;
    else S.form[k] = v;
    render();
  } else if (el.dataset.conv) {
    const k = el.dataset.conv; S.conv[k] = k === 'll' ? v : +v; if (k === 'ly' || k === 'lm') S.conv.ll = S.conv.ll && D.hasLeap(S.conv.ly, S.conv.lm); render();
  } else if (el.dataset.ics) {
    const k = el.dataset.ics; S.ics[k] = k === 'years' ? +v : v; store.set('icsYears', S.ics.years); store.set('icsHol', S.ics.holidays);
  } else if (el.dataset.hol) { S.holidays[el.dataset.hol] = v; store.set('holidays', S.holidays); }
  else if (el.dataset.share && S.sheet) { v ? S.sheet.share.add(el.dataset.share) : S.sheet.share.delete(el.dataset.share); render(); }
  else if (el.dataset.pick && S.sheet) { v ? S.sheet.pick.add(el.dataset.pick) : S.sheet.pick.delete(el.dataset.pick); render(); }
  else if (el.dataset.actFile === 'restore' && el.files[0]) {
    el.files[0].text().then((txt) => {
      const o = JSON.parse(txt);
      const list = (Array.isArray(o) ? o : o.events || []).map(D.sanitize).filter(Boolean);
      if (!list.length) throw new Error('empty');
      importSheet(list); S.sheet.restore = true; S.sheet.title = '💾 백업 불러오기'; render();
    }).catch(() => toast('백업 파일을 읽을 수 없어요'));
  }
});
document.addEventListener('input', (e) => { const k = e.target.dataset.form; if (S.form && (k === 'name' || k === 'note')) S.form[k] = e.target.value; });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && S.sheet) { S.sheet = null; render(); }
  if (S.section === 'calendar' && !S.form && !S.sheet && !e.target.closest('input,select')) { if (e.key === 'ArrowLeft') moveMonth(-1); if (e.key === 'ArrowRight') moveMonth(1); }
});
// 자정을 넘기면 다시 그림
let lastDN = D.todayDN();
setInterval(() => { const t = D.todayDN(); if (t !== lastDN) { lastDN = t; if (!S.form) render(); } }, 60000);

// 공유 링크로 열렸을 때
function checkImport() {
  const m = location.hash.match(/^#add=([A-Za-z0-9_-]+)$/);
  if (!m) return;
  history.replaceState(null, '', location.pathname + location.search);
  try { importSheet(D.decodeShare(m[1])); } catch { S.sheet = { title: '링크를 열 수 없어요', html: '<p class="small">링크가 잘렸거나 잘못된 것 같아요. 보낸 사람에게 다시 보내 달라고 해 주세요.</p>' }; }
}
window.addEventListener('hashchange', () => { checkImport(); render(); });
checkImport();
if (qs.get('form')) S.form = blankForm({ name: '엄마 생신', month: 3, day: 5, year: 1966 });
render();
keepOnDevice();
K.isPersisted().then((p) => { if (S.persisted == null) S.persisted = p; });
if ('serviceWorker' in navigator && location.protocol !== 'file:' && !qs.get('nosw')) navigator.serviceWorker.register('./sw.js').catch(() => {});
