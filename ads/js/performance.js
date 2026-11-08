// (b) 성과 — 날짜별 노출·클릭·비용·전환 입력(직접/CSV), 지표 카드, 추이 차트, 표
(function () {
  'use strict';
  var A = window.Ads, calc = A.calc, store = A.store, ui = A.ui, el = ui.el, csv = A.csv;

  // [키, 이름, 표시 방식]
  var METRICS = [
    ['cost', '비용', 'money'], ['impressions', '노출', 'num'], ['clicks', '클릭', 'num'], ['conversions', '전환', 'num'],
    ['ctr', '클릭률 (CTR)', 'pct'], ['cpc', '클릭당 비용 (CPC)', 'money'], ['cpa', '전환당 비용 (CPA)', 'money'],
  ];
  var PAGE = 100;
  var BUCKET_NAME = { day: '일별', week: '주별', month: '월별' };

  function formatter(kind) { return kind === 'money' ? ui.fmtMoney : kind === 'pct' ? ui.fmtPct : ui.fmtNum; }

  A.views.performance = function (ctx, root) {
    root.innerHTML =
      '<div class="toolbar">' +
        '<label class="field"><span>기간</span><select data-role="preset">' +
          '<option value="all">전체</option><option value="7d">최근 7일</option><option value="30d">최근 30일</option>' +
          '<option value="month">이번 달</option><option value="lastMonth">지난 달</option><option value="custom">직접 지정</option></select></label>' +
        '<label class="field" data-role="fromWrap" hidden><span>시작</span><input type="date" data-role="from"></label>' +
        '<label class="field" data-role="toWrap" hidden><span>끝</span><input type="date" data-role="to"></label>' +
        '<label class="field"><span>차트 지표</span><select data-role="metric"></select></label>' +
        '<div class="toolbar__spacer"></div>' +
        '<button type="button" class="btn btn--sm" data-role="importBtn">CSV 가져오기</button>' +
        '<button type="button" class="btn btn--sm" data-role="exportBtn">CSV 내보내기</button>' +
      '</div>' +
      '<div class="stats" data-role="stats"></div>' +
      '<div class="card"><h2 class="card__title" data-role="chartTitle">추이</h2><div class="chart" data-role="chart"></div></div>' +
      '<details class="card details" data-role="formCard"><summary>성과 직접 입력</summary>' +
        '<form data-role="form" autocomplete="off" style="display:flex;flex-direction:column;gap:14px">' +
          '<div class="form-grid">' +
            '<label class="field"><span>캠페인</span><select data-role="fCampaign" required></select></label>' +
            '<label class="field"><span>날짜</span><input type="date" data-role="fDate" required></label>' +
            '<label class="field"><span>노출</span><input type="number" min="0" step="any" inputmode="numeric" data-role="fImpressions" placeholder="0"></label>' +
            '<label class="field"><span>클릭</span><input type="number" min="0" step="any" inputmode="numeric" data-role="fClicks" placeholder="0"></label>' +
            '<label class="field"><span>비용 (원)</span><input type="number" min="0" step="any" inputmode="decimal" data-role="fCost" placeholder="0"></label>' +
            '<label class="field"><span>전환</span><input type="number" min="0" step="any" inputmode="decimal" data-role="fConversions" placeholder="0"></label>' +
          '</div>' +
          '<div class="composer__foot"><span class="hint" data-role="hint"></span>' +
            '<button type="submit" class="btn btn--primary" data-role="submit">저장</button></div>' +
        '</form>' +
      '</details>' +
      '<div class="searchbar">' +
        '<label class="search"><span class="visually-hidden">성과 검색</span>' +
          '<input type="search" data-role="q" placeholder="날짜나 캠페인으로 검색  (예: 2026-11, 11월 8일)" autocomplete="off"></label>' +
        '<span class="muted small" data-role="result" aria-live="polite"></span>' +
      '</div>' +
      '<div class="table-wrap"><table class="table"><thead data-role="thead"></thead><tbody data-role="tbody"></tbody></table></div>' +
      '<button type="button" class="btn more" data-role="more" hidden></button>';

    function $(r) { return root.querySelector('[data-role="' + r + '"]'); }
    var preset = $('preset'), from = $('from'), to = $('to'), metricSel = $('metric'),
        statsEl = $('stats'), chartEl = $('chart'), chartTitle = $('chartTitle'),
        formCard = $('formCard'), form = $('form'), fSel = $('fCampaign'), fDate = $('fDate'),
        fIm = $('fImpressions'), fCl = $('fClicks'), fCo = $('fCost'), fCv = $('fConversions'),
        hint = $('hint'), submit = $('submit'), q = $('q'), result = $('result'),
        thead = $('thead'), tbody = $('tbody'), more = $('more');

    METRICS.forEach(function (m) { metricSel.append(el('option', { value: m[0], text: m[1] })); });
    fDate.value = calc.today();
    var limit = PAGE, signature = '';

    // ---------- 필터 ----------
    function range() {
      if (preset.value === 'custom') {
        var f = from.value || null, t = to.value || null;
        if (f && t && f > t) { var x = f; f = t; t = x; }
        return { from: f, to: t };
      }
      return calc.rangePreset(preset.value);
    }
    function filteredRows() {
      var r = range();
      return calc.filterPerf(store.get().performance, { campaignId: ctx.current(), from: r.from, to: r.to });
    }

    [preset, from, to, metricSel].forEach(function (n) {
      n.addEventListener('change', function () {
        $('fromWrap').hidden = $('toWrap').hidden = preset.value !== 'custom';
        renderAll();
      });
    });
    q.addEventListener('input', renderTable);
    q.addEventListener('keydown', function (e) { if (e.key === 'Escape' && q.value) { q.value = ''; renderTable(); } });
    $('importBtn').addEventListener('click', function () { ctx.openData({ section: 'import', type: 'performance' }); });
    $('exportBtn').addEventListener('click', function () {
      var rows = filteredRows();
      if (!rows.length) { ui.toast('내보낼 데이터가 없어요.', true); return; }
      var out = [['날짜', '캠페인', '노출', '클릭', '비용', '전환', '클릭률(%)', 'CPC', 'CPA']];
      sorted(rows).forEach(function (r) {
        var m = calc.metrics(r), c = store.campaignById(r.campaignId);
        out.push([r.date, c ? c.name : '', r.impressions, r.clicks, r.cost, r.conversions,
          m.ctr === null ? '' : Math.round(m.ctr * 100) / 100, m.cpc === null ? '' : Math.round(m.cpc), m.cpa === null ? '' : Math.round(m.cpa)]);
      });
      ui.download('성과_' + ui.stamp() + '.csv', csv.toCSV(out), 'text/csv;charset=utf-8', true);
      ui.toast(rows.length + '행을 내보냈어요.');
    });

    // ---------- 입력 ----------
    function existing() {
      return store.get().performance.find(function (p) { return p.campaignId === fSel.value && p.date === fDate.value; });
    }
    function updateHint() {
      var camp = store.campaignById(fSel.value);
      formCard.setAttribute('data-c', camp ? camp.color : 'slate');    // 저장 버튼·포커스 색이 캠페인 색을 따르게
      var ex = existing(), im = calc.num(fIm.value), cl = calc.num(fCl.value);
      hint.className = 'hint';
      if (ex) { hint.textContent = '이 날짜는 이미 입력돼 있어요. 저장하면 덮어써요.'; hint.className = 'hint hint--warn'; }
      else if (!isNaN(im) && !isNaN(cl) && cl > im) { hint.textContent = '클릭이 노출보다 많아요. 숫자가 맞는지 확인해 주세요.'; hint.className = 'hint hint--warn'; }
      else hint.textContent = '같은 캠페인·같은 날짜를 다시 저장하면 덮어써요.';
    }
    function prefill() {      // 이미 입력된 날짜를 고르면 값을 불러와 수정하기 쉽게
      var ex = existing();
      if (ex) { fIm.value = ex.impressions; fCl.value = ex.clicks; fCo.value = ex.cost; fCv.value = ex.conversions; }
      updateHint();
    }
    fSel.addEventListener('change', prefill);
    fDate.addEventListener('change', prefill);
    [fIm, fCl, fCo, fCv].forEach(function (n) { n.addEventListener('input', updateHint); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var vals = { campaignId: fSel.value, date: fDate.value }, bad = false;
      [['impressions', fIm], ['clicks', fCl], ['cost', fCo], ['conversions', fCv]].forEach(function (p) {
        var n = calc.num(p[1].value);
        if (isNaN(n)) bad = true; else vals[p[0]] = n;
      });
      if (bad) { ui.toast('숫자만 입력해 주세요.', true); return; }
      var res = store.upsertPerformance(vals);
      if (!ui.report(res, res.replaced ? '같은 날짜가 있어 덮어썼어요.' : '저장했어요.')) return;
      [fIm, fCl, fCo, fCv].forEach(function (n) { n.value = ''; });
      updateHint();
      fIm.focus();
    });

    // ---------- 그리기 ----------
    function sorted(rows) {
      return rows.slice().sort(function (a, b) {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;         // 날짜 최신순
        var ca = store.campaignById(a.campaignId), cb = store.campaignById(b.campaignId);
        return (ca ? ca.name : '').localeCompare(cb ? cb.name : '', 'ko');
      });
    }

    function renderStats(rows) {
      var t = calc.sumPerf(rows), m = calc.metrics(t);
      var days = {}; rows.forEach(function (r) { days[r.date] = 1; });
      var nd = Object.keys(days).length;
      var tiles = [
        ['비용', ui.fmtMoney(t.cost), nd ? '입력된 ' + nd + '일 · 일평균 ' + ui.fmtMoney(t.cost / nd) : ''],
        ['노출', ui.fmtNum(t.impressions), ''],
        ['클릭', ui.fmtNum(t.clicks), ''],
        ['클릭률 (CTR)', ui.fmtPct(m.ctr), '클릭 ÷ 노출'],
        ['클릭당 비용 (CPC)', ui.fmtMoney(m.cpc), '비용 ÷ 클릭'],
        ['전환', ui.fmtNum(t.conversions), m.cvr === null ? '' : '전환율 ' + ui.fmtPct(m.cvr)],
        ['전환당 비용 (CPA)', ui.fmtMoney(m.cpa), '비용 ÷ 전환'],
      ];
      statsEl.replaceChildren.apply(statsEl, tiles.map(function (x) {
        return el('div', { class: 'stat' }, el('div', { class: 'stat__label', text: x[0] }),
          el('div', { class: 'stat__value', text: x[1] }), el('div', { class: 'stat__sub', text: x[2] || ' ' }));
      }));
    }

    function renderChart(rows, r) {
      var info = METRICS.find(function (m) { return m[0] === metricSel.value; }), fmt = formatter(info[2]);
      var cur = ctx.current();
      var ser = calc.series(rows, { from: r.from, to: r.to, metric: info[0], groupBy: cur === 'all' ? 'campaign' : 'none' });
      var camps = store.get().campaigns, list;
      if (cur === 'all') {
        list = camps.map(function (c) {
          var s = ser.series.find(function (x) { return x.id === c.id; });
          return s ? { label: c.name, color: c.color, values: s.values } : null;
        }).filter(Boolean);
      } else {
        var c = store.campaignById(cur);
        list = ser.series.map(function (s) { return { label: c ? c.name : '', color: c ? c.color : 'slate', values: s.values }; });
      }
      chartTitle.textContent = info[1] + ' 추이' + (ser.keys.length ? ' · ' + BUCKET_NAME[ser.bucket] : '');
      A.charts.line(chartEl, {
        keys: ser.keys, bucket: ser.bucket, series: list, fmt: fmt,
        axis: info[2] === 'pct' ? function (v) { return ui.fmtCompact(v) + '%'; } : null,
        ariaLabel: info[1] + ' 추이 차트',
      });
    }

    function renderTable() {
      var rows = sorted(filteredRows()), toks = calc.tokensOf(q.value), all = ctx.current() === 'all';
      var sig = [q.value, preset.value, from.value, to.value, ctx.current()].join('|');
      if (sig !== signature) { signature = sig; limit = PAGE; }

      if (toks.length) {
        rows = rows.filter(function (r) {
          var c = store.campaignById(r.campaignId);
          return calc.matches(calc.dateForms(r.date) + ' ' + (c ? c.name : ''), toks);
        });
      }
      result.textContent = (toks.length ? '검색 결과 ' : '') + rows.length + '건';

      var head = ['날짜'].concat(all ? ['캠페인'] : [], ['노출', '클릭', '클릭률', '비용', 'CPC', '전환', 'CPA', '']);
      thead.replaceChildren(el('tr', {}, head.map(function (h, i) {
        return el('th', { class: (h && h !== '날짜' && h !== '캠페인') ? 'num' : '', text: h, scope: 'col' });
      })));

      tbody.replaceChildren();
      if (!rows.length) {
        tbody.append(el('tr', {}, el('td', { colspan: head.length, class: 'chart__empty',
          text: toks.length ? '검색 결과가 없어요.' : '이 조건에 맞는 성과 데이터가 없어요.' })));
        more.hidden = true;
        return;
      }
      rows.slice(0, limit).forEach(function (r) {
        var m = calc.metrics(r), c = store.campaignById(r.campaignId);
        var cells = [el('td', { text: r.date })];
        if (all) cells.push(el('td', {}, c ? ui.badge(c) : ''));
        cells.push(
          el('td', { class: 'num', text: ui.fmtNum(r.impressions) }), el('td', { class: 'num', text: ui.fmtNum(r.clicks) }),
          el('td', { class: 'num', text: ui.fmtPct(m.ctr) }), el('td', { class: 'num', text: ui.fmtMoney(r.cost) }),
          el('td', { class: 'num', text: ui.fmtMoney(m.cpc) }), el('td', { class: 'num', text: ui.fmtNum(r.conversions) }),
          el('td', { class: 'num', text: ui.fmtMoney(m.cpa) }),
          el('td', { class: 'num' }, el('button', { type: 'button', class: 'del', 'data-id': r.id, 'aria-label': r.date + ' 성과 삭제', text: '삭제' })));
        tbody.append(el('tr', {}, cells));
      });
      more.hidden = rows.length <= limit;
      more.textContent = '더 보기 (' + (rows.length - limit) + '건 남음)';
    }
    more.addEventListener('click', function () { limit += PAGE; renderTable(); });
    tbody.addEventListener('click', function (e) {
      var b = e.target.closest('.del');
      if (!b) return;
      var p = store.get().performance.find(function (x) { return x.id === b.getAttribute('data-id'); });
      if (!p) return;
      var c = store.campaignById(p.campaignId);
      if (!confirm((c ? c.name : '') + ' ' + p.date + ' 성과를 삭제할까요?\n\n되돌릴 수 없어요.')) return;
      ui.report(store.deletePerformance(p.id), '삭제했어요.');
    });

    function renderAll() {
      var rows = filteredRows(), r = range();
      renderStats(rows);
      renderChart(rows, r);
      renderTable();
    }

    return {
      render: function () {
        var has = store.get().campaigns.length > 0;
        ctx.fillSelect(fSel);
        [fSel, fDate, fIm, fCl, fCo, fCv, submit].forEach(function (n) { n.disabled = !has; });
        if (!has) {
          statsEl.replaceChildren(); chartEl.replaceChildren(); tbody.replaceChildren(); thead.replaceChildren();
          result.textContent = ''; more.hidden = true;
          chartEl.append(ctx.emptyState());
          return;
        }
        if (!store.get().performance.length) formCard.open = true;   // 데이터가 하나도 없으면 입력창을 펼쳐서 안내
        updateHint();
        renderAll();
      },
    };
  };
})();
