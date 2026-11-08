// 계산 도우미 (화면과 무관한 순수 함수 — 브라우저와 Node 양쪽에서 동작해 검사하기 쉬움)
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.Ads = root.Ads || {}; root.Ads.calc = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DAY = 86400000;
  function pad(n) { return String(n).padStart(2, '0'); }

  // ---------- 날짜 ----------
  function validDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var d = new Date(s + 'T00:00:00Z');
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }
  // 2026-11-08 / 2026/11/8 / 2026.11.08 / 20261108 / 2026년 11월 8일 / 엑셀의 "2026-11-08 00:00:00" → "2026-11-08"
  function normDate(v) {
    if (v == null) return null;
    var s = String(v).trim().replace(/\s+\d{1,2}:\d{2}(:\d{2})?$/, '');
    var m = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/) ||
            s.match(/^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일?$/) ||
            s.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (!m) return null;
    var iso = m[1] + '-' + pad(m[2]) + '-' + pad(m[3]);
    return validDate(iso) ? iso : null;
  }
  function utc(iso) { return new Date(iso + 'T00:00:00Z').getTime(); }
  function addDays(iso, n) { return new Date(utc(iso) + n * DAY).toISOString().slice(0, 10); }
  function daysBetween(a, b) { return Math.round((utc(b) - utc(a)) / DAY); }
  function today(now) {
    var d = now || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  // ---------- 달력 ----------
  function monthStart(iso) { return iso.slice(0, 7) + '-01'; }
  function monthEnd(iso) {      // 그 달의 마지막 날 (다음 달 1일의 하루 전)
    var y = +iso.slice(0, 4), m = +iso.slice(5, 7);
    return addDays((m === 12 ? y + 1 : y) + '-' + pad(m === 12 ? 1 : m + 1) + '-01', -1);
  }
  // n 달 뒤(음수면 앞)의 1일: addMonths('2026-01-31', 1) → '2026-02-01'
  function addMonths(iso, n) {
    var total = (+iso.slice(0, 4)) * 12 + (+iso.slice(5, 7) - 1) + n;
    return Math.floor(total / 12) + '-' + pad((total % 12) + 1) + '-01';
  }
  // 월 달력 격자: 일요일 시작, 그 달이 걸친 주만큼 (4~6주). 앞뒤 달 날짜도 채움
  function monthGrid(iso) {
    var first = monthStart(iso), last = monthEnd(iso);
    var start = addDays(first, -new Date(first + 'T00:00:00Z').getUTCDay());
    var weeks = [];
    for (var w = start; w <= last; w = addDays(w, 7)) {
      var row = [];
      for (var i = 0; i < 7; i++) row.push(addDays(w, i));
      weeks.push(row);
    }
    return { month: first.slice(0, 7), first: first, last: last, weeks: weeks };
  }
  // 오늘 기준 남은 날: 0 → "오늘", 3 → "D-3", -2 → "2일 지남"
  function ddayLabel(todayIso, dateIso) {
    var n = daysBetween(todayIso, dateIso);
    return n === 0 ? '오늘' : n > 0 ? 'D-' + n : Math.abs(n) + '일 지남';
  }

  // ---------- 검색 ----------
  function tokensOf(q) { return String(q || '').trim().toLowerCase().split(/\s+/).filter(Boolean); }
  // 날짜는 여러 표기로 찾을 수 있게: 2026-11-08 / 2026.11.08 / 2026/11/8 / 2026년 11월 8일 / 11월 8일 / 11/8
  function dateForms(iso) {
    var p = iso.split('-'), y = p[0], m = p[1], d = p[2], mn = +m, dn = +d;
    return [iso, y + '.' + m + '.' + d, y + '/' + mn + '/' + dn, y + '년 ' + mn + '월 ' + dn + '일', mn + '월 ' + dn + '일', mn + '/' + dn].join(' ');
  }
  function matches(haystack, tokens) {
    var h = String(haystack || '').toLowerCase();
    return tokens.every(function (t) { return h.indexOf(t) !== -1; });   // 단어가 모두 들어 있어야 함
  }

  // ---------- 소재 점검 ----------
  function checklistProgress(c) {
    var list = c.checklist || [];
    var done = list.filter(function (x) { return x.done; }).length;
    return { done: done, total: list.length, pct: list.length ? (done / list.length) * 100 : 0 };
  }

  return {
    validDate: validDate, normDate: normDate, addDays: addDays, daysBetween: daysBetween, today: today,
    monthStart: monthStart, monthEnd: monthEnd, addMonths: addMonths, monthGrid: monthGrid, ddayLabel: ddayLabel,
    tokensOf: tokensOf, dateForms: dateForms, matches: matches, checklistProgress: checklistProgress,
  };
});
