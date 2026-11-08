// 음력 계산 엔진 — 사주낙서와 같은 식 (VSOP87 태양 황경, Meeus 삭 계산, 한국 시간대 이력, 중기 규칙 윤달)
const { floor, trunc, sin, cos, tan, abs, PI } = Math;
const pow = Math.pow;

// ───────────────────────── 천문

export const Astro = (() => {
  const JD_UNIX = 2440587.5;
  const jd = (t) => t / 86400 + JD_UNIX;
  const time = (j) => (j - JD_UNIX) * 86400;

  function deltaT(jdUT) {
    const y = 2000 + (jdUT - 2451544.5) / 365.2425;
    let t, u;
    if (y < 1860) { u = (y - 1820) / 100; return -20 + 32 * u * u; }
    if (y < 1900) { t = y - 1860; return 7.62 + 0.5737 * t - 0.251754 * pow(t, 2) + 0.01680668 * pow(t, 3) - 0.0004473624 * pow(t, 4) + pow(t, 5) / 233174; }
    if (y < 1920) { t = y - 1900; return -2.79 + 1.494119 * t - 0.0598939 * pow(t, 2) + 0.0061966 * pow(t, 3) - 0.000197 * pow(t, 4); }
    if (y < 1941) { t = y - 1920; return 21.20 + 0.84493 * t - 0.076100 * pow(t, 2) + 0.0020936 * pow(t, 3); }
    if (y < 1961) { t = y - 1950; return 29.07 + 0.407 * t - pow(t, 2) / 233 + pow(t, 3) / 2547; }
    if (y < 1986) { t = y - 1975; return 45.45 + 1.067 * t - pow(t, 2) / 260 - pow(t, 3) / 718; }
    if (y < 2005) { t = y - 2000; return 63.86 + 0.3345 * t - 0.060374 * pow(t, 2) + 0.0017275 * pow(t, 3) + 0.000651814 * pow(t, 4) + 0.00002373599 * pow(t, 5); }
    if (y < 2050) { t = y - 2000; return 62.92 + 0.32217 * t + 0.005589 * pow(t, 2); }
    if (y < 2150) { u = (y - 1820) / 100; return -20 + 32 * u * u - 0.5628 * (2150 - y); }
    u = (y - 1820) / 100; return -20 + 32 * u * u;
  }

  const t3 = (a) => { const r = []; for (let i = 0; i < a.length; i += 3) r.push([a[i], a[i + 1], a[i + 2]]); return r; };
  const L0 = t3([175347046, 0, 0, 3341656, 4.6692568, 6283.0758500, 34894, 4.62610, 12566.15170, 3497, 2.7441, 5753.3849, 3418, 2.8289, 3.5231, 3136, 3.6277, 77713.7715, 2676, 4.4181, 7860.4194, 2343, 6.1352, 3930.2097, 1324, 0.7425, 11506.7698, 1273, 2.0371, 529.6910, 1199, 1.1096, 1577.3435, 990, 5.233, 5884.927, 902, 2.045, 26.298, 857, 3.508, 398.149, 780, 1.179, 5223.694, 753, 2.533, 5507.553, 505, 4.583, 18849.228, 492, 4.205, 775.523, 357, 2.920, 0.067, 317, 5.849, 11790.629, 284, 1.899, 796.298, 271, 0.315, 10977.079, 243, 0.345, 5486.778, 206, 4.806, 2544.314, 205, 1.869, 5573.143, 202, 2.458, 6069.777, 156, 0.833, 213.299, 132, 3.411, 2942.463, 126, 1.083, 20.775, 115, 0.645, 0.980, 103, 0.636, 4694.003, 102, 0.976, 15720.839, 102, 4.267, 7.114, 99, 6.21, 2146.17, 98, 0.68, 155.42, 86, 5.98, 161000.69, 85, 1.30, 6275.96, 85, 3.67, 71430.70, 80, 1.81, 17260.15, 79, 3.04, 12036.46, 75, 1.76, 5088.63, 74, 3.50, 3154.69, 74, 4.68, 801.82, 70, 0.83, 9437.76, 62, 3.98, 8827.39, 61, 1.82, 7084.90, 57, 2.78, 6286.60, 56, 4.39, 14143.50, 56, 3.47, 6279.55, 52, 0.19, 12139.55, 52, 1.33, 1748.02, 51, 0.28, 5856.48, 49, 0.49, 1194.45, 41, 5.37, 8429.24, 41, 2.40, 19651.05, 39, 6.17, 10447.39, 37, 6.04, 10213.29, 37, 2.57, 1059.38, 36, 1.71, 2352.87, 36, 1.78, 6812.77, 33, 0.59, 17789.85, 30, 0.44, 83996.85, 30, 2.74, 1349.87, 25, 3.16, 4690.48]);
  const L1 = t3([628331966747, 0, 0, 206059, 2.678235, 6283.07585, 4303, 2.6351, 12566.1517, 425, 1.590, 3.523, 119, 5.796, 26.298, 109, 2.966, 1577.344, 93, 2.59, 18849.23, 72, 1.14, 529.69, 68, 1.87, 398.15, 67, 4.41, 5507.55, 59, 2.89, 5223.69, 56, 2.17, 155.42, 45, 0.40, 796.30, 36, 0.47, 775.52, 29, 2.65, 7.11, 21, 5.34, 0.98, 19, 1.85, 5486.78, 19, 4.97, 213.30, 17, 2.99, 6275.96, 16, 0.03, 2544.31, 16, 1.43, 2146.17, 15, 1.21, 10977.08, 12, 2.83, 1748.02, 12, 3.26, 5088.63, 12, 5.27, 1194.45, 12, 2.08, 4694.00, 11, 0.77, 553.57, 10, 1.30, 6286.60, 10, 4.24, 1349.87, 9, 2.70, 242.73, 9, 5.64, 951.72, 8, 5.30, 2352.87, 6, 2.65, 9437.76, 6, 4.67, 4690.48]);
  const L2 = t3([52919, 0, 0, 8720, 1.0721, 6283.0758, 309, 0.867, 12566.152, 27, 0.05, 3.52, 16, 5.19, 26.30, 16, 3.68, 155.42, 10, 0.76, 18849.23, 9, 2.06, 77713.77, 7, 0.83, 775.52, 5, 4.66, 1577.34, 4, 1.03, 7.11, 4, 3.44, 5573.14, 3, 5.14, 796.30, 3, 6.05, 5507.55, 3, 1.19, 242.73, 3, 6.12, 529.69, 3, 0.31, 398.15, 3, 2.28, 553.57, 2, 4.38, 5223.69, 2, 3.75, 0.98]);
  const L3 = t3([289, 5.844, 6283.076, 35, 0, 0, 17, 5.49, 12566.15, 3, 5.20, 155.42, 1, 4.72, 3.52, 1, 5.30, 18849.23, 1, 5.97, 242.73]);
  const L4 = t3([114, 3.142, 0, 8, 4.13, 6283.08, 1, 3.84, 12566.15]);
  const L5 = t3([1, 3.14, 0]);
  const R0 = t3([100013989, 0, 0, 1670700, 3.0984635, 6283.0758500, 13956, 3.05525, 12566.15170, 3084, 5.1985, 77713.7715, 1628, 1.1739, 5753.3849, 1576, 2.8469, 7860.4194, 925, 5.453, 11506.770, 542, 4.564, 3930.210, 472, 3.661, 5884.927]);
  const R1 = t3([103019, 1.107490, 6283.075850, 1721, 1.0644, 12566.1517, 702, 3.142, 0]);
  const R2 = t3([4359, 5.7846, 6283.0758, 124, 5.579, 12566.152]);
  const series = (terms, tau) => { let s = 0; for (const [a, b, c] of terms) s += a * cos(b + c * tau); return s; };
  const norm360 = (x) => { const r = x % 360; return r < 0 ? r + 360 : r; };

  function sunLongitudeJD(jdUT) {
    const jde = jdUT + deltaT(jdUT) / 86400;
    const tau = (jde - 2451545.0) / 365250.0;
    const tt = tau * 10;
    const L = (series(L0, tau) + series(L1, tau) * tau + series(L2, tau) * pow(tau, 2) + series(L3, tau) * pow(tau, 3) + series(L4, tau) * pow(tau, 4) + series(L5, tau) * pow(tau, 5)) / 1e8;
    const R = (series(R0, tau) + series(R1, tau) * tau + series(R2, tau) * pow(tau, 2)) / 1e8;
    let theta = L * 180 / PI + 180;
    theta -= 0.09033 / 3600;
    const omega = (125.04452 - 1934.136261 * tt) * PI / 180;
    const ls = (280.4665 + 36000.7698 * tt) * PI / 180;
    const lm = (218.3165 + 481267.8813 * tt) * PI / 180;
    const dPsi = (-17.20 * sin(omega) - 1.32 * sin(2 * ls) - 0.23 * sin(2 * lm) + 0.21 * sin(2 * omega)) / 3600;
    return norm360(theta + dPsi - 20.4898 / 3600 / R);
  }
  const sunLongitude = (t) => sunLongitudeJD(jd(t));

  function solveSunLongitude(target, near) {
    let j = jd(near);
    for (let i = 0; i < 30; i++) {
      let diff = (target - sunLongitudeJD(j)) % 360;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      const step = diff * 365.2422 / 360 * 0.98;
      j += step;
      if (abs(step) < 1e-7) break;
    }
    return time(j);
  }

  function nextLongitude(after, step, offset = 0) {
    const lon = sunLongitude(after);
    let k = floor((lon - offset) / step) + 1;
    let target = norm360(offset + k * step);
    let t = solveSunLongitude(target, after + norm360(target - lon) * 365.2422 / 360 * 86400);
    if (t <= after) { k += 1; target = norm360(offset + k * step); t = solveSunLongitude(target, t + step * 365.2422 / 360 * 86400); }
    return [t, target];
  }

  function previousLongitude(before, step, offset = 0) {
    const lon = sunLongitude(before);
    const k = floor((lon - offset) / step);
    const target = norm360(offset + k * step);
    let t = solveSunLongitude(target, before - norm360(lon - target) * 365.2422 / 360 * 86400);
    if (t > before) {
      const prev = norm360(target - step);
      t = solveSunLongitude(prev, t - step * 365.2422 / 360 * 86400);
      return [t, prev];
    }
    return [t, target];
  }

  const A14 = t3([0.000325, 299.77, 0.107408, 0.000165, 251.88, 0.016321, 0.000164, 251.83, 26.651886, 0.000126, 349.42, 36.412478, 0.000110, 84.66, 18.206239, 0.000062, 141.74, 53.303771, 0.000060, 207.14, 2.453732, 0.000056, 154.84, 7.306860, 0.000047, 34.52, 27.261239, 0.000042, 207.19, 0.121824, 0.000040, 291.34, 1.844379, 0.000037, 161.72, 24.198154, 0.000035, 239.56, 25.513099, 0.000023, 331.55, 3.592518]);
  function newMoon(k) {
    const t = k / 1236.85, t2 = t * t, t3_ = t2 * t, t4 = t3_ * t;
    let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * t2 - 0.000000150 * t3_ + 0.00000000073 * t4;
    const e = 1 - 0.002516 * t - 0.0000074 * t2, rad = PI / 180;
    const m = (2.5534 + 29.10535670 * k - 0.0000014 * t2 - 0.00000011 * t3_) * rad;
    const mp = (201.5643 + 385.81693528 * k + 0.0107582 * t2 + 0.00001238 * t3_ - 0.000000058 * t4) * rad;
    const f = (160.7108 + 390.67050284 * k - 0.0016118 * t2 - 0.00000227 * t3_ + 0.000000011 * t4) * rad;
    const om = (124.7746 - 1.56375588 * k + 0.0020672 * t2 + 0.00000215 * t3_) * rad;
    let c = -0.40720 * sin(mp);
    c += 0.17241 * e * sin(m); c += 0.01608 * sin(2 * mp); c += 0.01039 * sin(2 * f); c += 0.00739 * e * sin(mp - m);
    c -= 0.00514 * e * sin(mp + m); c += 0.00208 * e * e * sin(2 * m); c -= 0.00111 * sin(mp - 2 * f); c -= 0.00057 * sin(mp + 2 * f);
    c += 0.00056 * e * sin(2 * mp + m); c -= 0.00042 * sin(3 * mp); c += 0.00042 * e * sin(m + 2 * f); c += 0.00038 * e * sin(m - 2 * f);
    c -= 0.00024 * e * sin(2 * mp - m); c -= 0.00017 * sin(om); c -= 0.00007 * sin(mp + 2 * m); c += 0.00004 * sin(2 * mp - 2 * f);
    c += 0.00004 * sin(3 * m); c += 0.00003 * sin(mp + m - 2 * f); c += 0.00003 * sin(2 * mp + 2 * f); c -= 0.00003 * sin(mp + m + 2 * f);
    c += 0.00003 * sin(mp - m + 2 * f); c -= 0.00002 * sin(mp - m - 2 * f); c -= 0.00002 * sin(3 * mp + m); c += 0.00002 * sin(4 * mp);
    let planetary = 0;
    A14.forEach(([a, b, cc], i) => { let arg = b + cc * k; if (i === 0) arg -= 0.009173 * t2; planetary += a * sin(arg * rad); });
    jde += c + planetary;
    return jde - deltaT(jde) / 86400;
  }
  const lunationIndex = (jdUT) => floor((jdUT - 2451550.09766) / 29.530588861);

  function equationOfTime(tm) {
    const j = jd(tm), t = (j - 2451545.0) / 36525, rad = PI / 180;
    const l0 = norm360(280.46646 + 36000.76983 * t + 0.0003032 * t * t) * rad;
    const m = (357.52911 + 35999.05029 * t - 0.0001537 * t * t) * rad;
    const e = 0.016708634 - 0.000042037 * t;
    const eps = (23.439291 - 0.0130042 * t) * rad;
    const y = pow(tan(eps / 2), 2);
    const eq = y * sin(2 * l0) - 2 * e * sin(m) + 4 * e * y * sin(m) * cos(2 * l0) - 0.5 * y * y * sin(4 * l0) - 1.25 * e * e * sin(2 * m);
    return eq * 180 / PI * 4;
  }

  return { jd, time, deltaT, sunLongitude, solveSunLongitude, nextLongitude, previousLongitude, newMoon, lunationIndex, equationOfTime, norm360 };
})();

// ───────────────────────── 한국 시간 · 음력

const seoulFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
const offCache = new Map();

export const KCal = (() => {
  /** 그 순간의 한국 법정 시각 오프셋(초): 표준시 + 서머타임 */
  function legalOffset(t) {
    const s = floor(t);
    const key = floor(s / 900);
    if (offCache.has(key)) return offCache.get(key);
    const parts = {};
    for (const p of seoulFmt.formatToParts(new Date(s * 1000))) parts[p.type] = p.value;
    const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second) / 1000;
    let y = +parts.year; if (y <= 0) y = 1; // 안전장치
    const off = wall - s;
    if (offCache.size > 50000) offCache.clear();
    offCache.set(key, off);
    return off;
  }
  /** 서머타임 여부: 앞뒤 반년보다 오프셋이 크면 서머타임 */
  function isDST(t) {
    const o = legalOffset(t);
    return o > legalOffset(t - 182 * 86400) && o > legalOffset(t + 182 * 86400);
  }
  const standardOffset = (t) => legalOffset(t) - (isDST(t) ? 3600 : 0);

  /** 한국 벽시계 날짜·시각 → 순간 */
  function instant(y, m, d, h, mi) {
    const wall = Date.UTC(y, m - 1, d, h, mi) / 1000;
    let t = wall - 9 * 3600;
    for (let i = 0; i < 3; i++) t = wall - legalOffset(t);
    return t;
  }
  const utcMidnight = (y, m, d) => Date.UTC(y, m - 1, d) / 1000;
  function seoulParts(t) {
    const parts = {};
    for (const p of seoulFmt.formatToParts(new Date(floor(t) * 1000))) parts[p.type] = +p.value;
    return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour % 24, minute: parts.minute };
  }
  function utcParts(t) {
    const d = new Date(floor(t) * 1000);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: d.getUTCHours(), minute: d.getUTCMinutes() };
  }

  function dayNumber(year, month, day) {
    const a = trunc((14 - month) / 12), y = year + 4800 - a, m = month + 12 * a - 3;
    return day + trunc((153 * m + 2) / 5) + 365 * y + trunc(y / 4) - trunc(y / 100) + trunc(y / 400) - 32045;
  }
  function ymd(jdn) {
    const a = jdn + 32044, b = trunc((4 * a + 3) / 146097), c = a - trunc(146097 * b / 4);
    const d = trunc((4 * c + 3) / 1461), e = c - trunc(1461 * d / 4), m = trunc((5 * e + 2) / 153);
    return [100 * b + d - 4800 + trunc(m / 10), m + 3 - 12 * trunc(m / 10), e - trunc((153 * m + 2) / 5) + 1];
  }
  const standardDayNumber = (t) => floor(Astro.jd(t) + standardOffset(t) / 86400 + 0.5);
  function startOfStandardDay(d) {
    const approx = Astro.time(d - 0.5 - 9.0 / 24);
    return Astro.time(d - 0.5 - standardOffset(approx) / 86400);
  }

  const suiCache = new Map();
  function sui(y) {
    if (suiCache.has(y)) return suiCache.get(y);
    const ws1 = Astro.solveSunLongitude(270, utcMidnight(y - 1, 12, 21));
    const ws2 = Astro.solveSunLongitude(270, utcMidnight(y, 12, 21));
    const d1 = standardDayNumber(ws1), d2 = standardDayNumber(ws2);
    let k = Astro.lunationIndex(Astro.jd(ws1)) - 2;
    const starts = [];
    for (;;) {
      const d = standardDayNumber(Astro.time(Astro.newMoon(k)));
      starts.push(d);
      if (d > d2 + 31) break;
      k += 1;
    }
    let i11a = -1, i11b = -1;
    starts.forEach((d, i) => { if (d <= d1) i11a = i; if (d <= d2) i11b = i; });
    if (i11a < 0 || i11b < 0) return [];
    const ms = starts.slice(i11a, i11b + 1);
    const count = ms.length - 1;
    const lonAt = (d) => Astro.sunLongitude(startOfStandardDay(d));
    const hasZ = [];
    for (let i = 0; i < count; i++) hasZ.push(floor(lonAt(ms[i]) / 30) !== floor(lonAt(ms[i + 1]) / 30));
    const out = [];
    let number = 11, leapUsed = count === 12, newYear = false;
    for (let i = 0; i < count; i++) {
      let leap = false;
      if (i > 0) {
        if (!leapUsed && !hasZ[i]) { leap = true; leapUsed = true; }
        else { number = number % 12 + 1; if (number === 1) newYear = true; }
      }
      out.push({ start: ms[i], length: ms[i + 1] - ms[i], year: newYear ? y : y - 1, month: number, leap });
    }
    suiCache.set(y, out);
    return out;
  }
  function lunarToDayNumber(year, month, day, leap) {
    for (const s of [year, year + 1]) {
      const m = sui(s).find((x) => x.year === year && x.month === month && x.leap === leap);
      if (!m) continue;
      if (day < 1 || day > m.length) return null;
      return m.start + day - 1;
    }
    return null;
  }
  function lunarDate(d) {
    const y = ymd(d)[0];
    for (const s of [y, y + 1]) {
      const m = sui(s).find((x) => d >= x.start && d < x.start + x.length);
      if (m) return { year: m.year, month: m.month, day: d - m.start + 1, leap: m.leap };
    }
    return null;
  }
  const hasLeapMonth = (year, month) => [year, year + 1].some((s) => sui(s).some((x) => x.year === year && x.month === month && x.leap));
  function lunarMonthLength(year, month, leap) {
    for (const s of [year, year + 1]) { const m = sui(s).find((x) => x.year === year && x.month === month && x.leap === leap); if (m) return m.length; }
    return null;
  }
  return { legalOffset, standardOffset, isDST, instant, utcMidnight, seoulParts, utcParts, dayNumber, ymd, sui, lunarToDayNumber, lunarDate, hasLeapMonth, lunarMonthLength };
})();

// ───────────────────────── 기본 표
