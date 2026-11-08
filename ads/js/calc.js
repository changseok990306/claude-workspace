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
  function daysBetween(a, b) { return Math.round((utc(b) - utc(a)) / DAY); }
  function addDays(iso, n) { return new Date(utc(iso) + n * DAY).toISOString().slice(0, 10); }
  function today(now) {
    var d = now || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function monthStart(iso) { return iso.slice(0, 7) + '-01'; }
  function monthEnd(iso) {
    var y = +iso.slice(0, 4), m = +iso.slice(5, 7);
    return addDays((m === 12 ? y + 1 : y) + '-' + pad(m === 12 ? 1 : m + 1) + '-01', -1);   // 다음 달 1일의 하루 전
  }

  // ---------- 숫자 ----------
  // "1,234" "₩1,234" "12%" "" → 숫자 / 빈칸은 0 / 숫자가 아니면 NaN
  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    var s = String(v == null ? '' : v).trim();
    if (s === '') return 0;
    s = s.replace(/[,\s원₩$%]/g, '');
    if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
    return Number(s);
  }

  // ---------- 광고 지표 ----------
  // CTR(클릭률) = 클릭/노출, CPC(클릭당 비용) = 비용/클릭, CPA(전환당 비용) = 비용/전환, CVR(전환율) = 전환/클릭
  // 나누는 값이 0이면 null (화면에서 "-" 로 표시)
  function metrics(t) {
    var i = t.impressions || 0, c = t.clicks || 0, cost = t.cost || 0, v = t.conversions || 0;
    return {
      ctr: i > 0 ? (c / i) * 100 : null,
      cpc: c > 0 ? cost / c : null,
      cpa: v > 0 ? cost / v : null,
      cvr: c > 0 ? (v / c) * 100 : null,
    };
  }
  function sumPerf(rows) {
    var t = { impressions: 0, clicks: 0, cost: 0, conversions: 0 };
    rows.forEach(function (r) {
      t.impressions += r.impressions || 0; t.clicks += r.clicks || 0;
      t.cost += r.cost || 0; t.conversions += r.conversions || 0;
    });
    return t;
  }
  function metricValue(t, metric) {
    if (metric === 'ctr' || metric === 'cpc' || metric === 'cpa' || metric === 'cvr') return metrics(t)[metric];
    return t[metric] || 0;
  }
  function filterPerf(rows, f) {
    f = f || {};
    return rows.filter(function (r) {
      if (f.campaignId && f.campaignId !== 'all' && r.campaignId !== f.campaignId) return false;
      if (f.from && r.date < f.from) return false;
      if (f.to && r.date > f.to) return false;
      return true;
    });
  }
  function rangePreset(p, now) {
    var t = today(now);
    if (p === '7d') return { from: addDays(t, -6), to: t };
    if (p === '30d') return { from: addDays(t, -29), to: t };
    if (p === 'month') return { from: monthStart(t), to: t };
    if (p === 'lastMonth') {
      var lastDayPrev = addDays(monthStart(t), -1);
      return { from: monthStart(lastDayPrev), to: lastDayPrev };
    }
    return { from: null, to: null };
  }

  // ---------- 차트용 시계열 ----------
  function pickBucket(spanDays) { return spanDays <= 92 ? 'day' : spanDays <= 550 ? 'week' : 'month'; }
  function bucketKey(iso, b) {
    if (b === 'week') { var dow = (new Date(iso + 'T00:00:00Z').getUTCDay() + 6) % 7; return addDays(iso, -dow); }  // 월요일 시작
    if (b === 'month') return monthStart(iso);
    return iso;
  }
  function nextBucket(iso, b) {
    if (b === 'week') return addDays(iso, 7);
    if (b === 'month') { var y = +iso.slice(0, 4), m = +iso.slice(5, 7); return (m === 12 ? y + 1 : y) + '-' + pad(m === 12 ? 1 : m + 1) + '-01'; }
    return addDays(iso, 1);
  }
  // opts: { from, to, metric, groupBy: 'campaign' | 'none' }  → { keys, bucket, series:[{id, values}] }
  function series(rows, opts) {
    if (!rows.length) return { keys: [], bucket: 'day', series: [] };
    var from = opts.from, to = opts.to;
    if (!from || !to) {
      var dates = rows.map(function (r) { return r.date; }).sort();
      from = from || dates[0]; to = to || dates[dates.length - 1];
    }
    var bucket = pickBucket(daysBetween(from, to) + 1);
    var keys = [];
    for (var k = bucketKey(from, bucket); k <= to && keys.length < 2000; k = nextBucket(k, bucket)) keys.push(k);
    var index = {}; keys.forEach(function (k2, i) { index[k2] = i; });

    var groups = {};  // id → 키별 합계 (n = 그 구간에 입력된 행 수)
    rows.forEach(function (r) {
      var i = index[bucketKey(r.date, bucket)];
      if (i === undefined) return;
      var id = opts.groupBy === 'campaign' ? r.campaignId : 'all';
      var g = groups[id] || (groups[id] = keys.map(function () { return { impressions: 0, clicks: 0, cost: 0, conversions: 0, n: 0 }; }));
      g[i].impressions += r.impressions || 0; g[i].clicks += r.clicks || 0;
      g[i].cost += r.cost || 0; g[i].conversions += r.conversions || 0; g[i].n++;
    });
    return {
      keys: keys, bucket: bucket,
      series: Object.keys(groups).map(function (id) {
        // 입력된 데이터가 없는 구간은 0 이 아니라 null → 차트에서 선을 끊어 "데이터 없음"으로 보임
        return { id: id, values: groups[id].map(function (t) { return t.n ? metricValue(t, opts.metric) : null; }) };
      }),
    };
  }

  // ---------- 예산 · 일정 ----------
  function spentFor(budget, perfRows) {
    var s = 0;
    perfRows.forEach(function (r) {
      if (r.campaignId === budget.campaignId && r.date >= budget.start && r.date <= budget.end) s += r.cost || 0;
    });
    return s;
  }
  // 집행 전/중/종료, 소진율, 기간 경과율, 일평균, 예상 최종 집행액, 경고
  function budgetStatus(b, spent, nowIso) {
    var total = daysBetween(b.start, b.end) + 1;
    var state, elapsed;
    if (nowIso < b.start) { state = 'before'; elapsed = 0; }
    else if (nowIso > b.end) { state = 'ended'; elapsed = total; }
    else { state = 'running'; elapsed = daysBetween(b.start, nowIso) + 1; }
    var remainingDays = total - elapsed;
    var remaining = b.amount - spent;
    var perDay = elapsed > 0 ? spent / elapsed : 0;
    var projected = state === 'running' ? perDay * total : spent;
    return {
      state: state, totalDays: total, elapsedDays: elapsed, remainingDays: remainingDays,
      spent: spent, remaining: remaining,
      usedPct: b.amount > 0 ? (spent / b.amount) * 100 : (spent > 0 ? 100 : 0),
      timePct: (elapsed / total) * 100,
      perDay: perDay, projected: projected,
      suggestedDaily: remainingDays > 0 ? Math.max(0, remaining) / remainingDays : 0,
      over: spent > b.amount,
      paceWarn: state === 'running' && spent <= b.amount && projected > b.amount * 1.05,
    };
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
  function checklistProgress(c) {
    var list = c.checklist || [];
    var done = list.filter(function (x) { return x.done; }).length;
    return { done: done, total: list.length, pct: list.length ? (done / list.length) * 100 : 0 };
  }

  return {
    validDate: validDate, normDate: normDate, daysBetween: daysBetween, addDays: addDays, today: today,
    monthStart: monthStart, monthEnd: monthEnd, num: num,
    metrics: metrics, sumPerf: sumPerf, metricValue: metricValue, filterPerf: filterPerf, rangePreset: rangePreset,
    pickBucket: pickBucket, bucketKey: bucketKey, series: series,
    spentFor: spentFor, budgetStatus: budgetStatus,
    tokensOf: tokensOf, dateForms: dateForms, matches: matches, checklistProgress: checklistProgress,
  };
});
