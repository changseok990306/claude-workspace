// (c) 예산·일정 — 캠페인별 예산·집행 기간, 성과 탭의 비용으로 소진율/잔액/속도 자동 계산
(function () {
  'use strict';
  var A = window.Ads, calc = A.calc, store = A.store, ui = A.ui, el = ui.el, csv = A.csv;

  var STATE_ORDER = { running: 0, before: 1, ended: 2 };
  var STATE_LABEL = { running: '집행 중', before: '집행 전', ended: '종료' };

  A.views.budget = function (ctx, root) {
    root.innerHTML =
      '<div class="toolbar">' +
        '<label class="field"><span>상태</span><select data-role="state">' +
          '<option value="all">전체</option><option value="running">집행 중</option><option value="before">집행 전</option><option value="ended">종료</option></select></label>' +
        '<div class="toolbar__spacer"></div>' +
        '<button type="button" class="btn btn--sm" data-role="importBtn">CSV 가져오기</button>' +
        '<button type="button" class="btn btn--sm" data-role="exportBtn">CSV 내보내기</button>' +
      '</div>' +
      '<div class="stats" data-role="summary"></div>' +
      '<p class="hint hint--warn" data-role="overlap" hidden></p>' +
      '<details class="card details" data-role="formCard"><summary>예산 추가</summary>' +
        '<form data-role="form" autocomplete="off" style="display:flex;flex-direction:column;gap:14px">' +
          '<div class="form-grid">' +
            '<label class="field"><span>캠페인</span><select data-role="fCampaign" required></select></label>' +
            '<label class="field"><span>시작일</span><input type="date" data-role="fStart" required></label>' +
            '<label class="field"><span>종료일</span><input type="date" data-role="fEnd" required></label>' +
            '<label class="field"><span>예산 (원)</span><input type="number" min="0" step="1" inputmode="numeric" data-role="fAmount" required placeholder="3000000"></label>' +
            '<label class="field"><span>메모 (선택)</span><input type="text" maxlength="100" data-role="fMemo" placeholder="예: 11월 집행분"></label>' +
          '</div>' +
          '<div class="composer__foot"><span class="hint" data-role="hint">집행액은 성과 탭에 입력한 비용에서 자동으로 계산돼요.</span>' +
            '<button type="submit" class="btn btn--primary" data-role="submit">예산 추가</button></div>' +
        '</form>' +
      '</details>' +
      '<div class="card" data-role="ganttCard"><h2 class="card__title">집행 일정</h2><div class="gantt" data-role="gantt"></div></div>' +
      '<div class="budgets" data-role="list"></div>';

    function $(r) { return root.querySelector('[data-role="' + r + '"]'); }
    var stateSel = $('state'), summary = $('summary'), overlap = $('overlap'), formCard = $('formCard'), form = $('form'),
        fSel = $('fCampaign'), fStart = $('fStart'), fEnd = $('fEnd'), fAmount = $('fAmount'), fMemo = $('fMemo'),
        submit = $('submit'), ganttCard = $('ganttCard'), gantt = $('gantt'), list = $('list');

    var today0 = calc.today();
    fStart.value = today0; fEnd.value = calc.addDays(today0, 29);

    stateSel.addEventListener('change', renderAll);
    $('importBtn').addEventListener('click', function () { ctx.openData({ section: 'import', type: 'budgets' }); });
    fSel.addEventListener('change', syncColor);
    function syncColor() {
      var c = store.campaignById(fSel.value);
      formCard.setAttribute('data-c', c ? c.color : 'slate');
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var amount = calc.num(fAmount.value);
      if (isNaN(amount)) { ui.toast('예산 금액은 숫자로 입력해 주세요.', true); return; }
      var res = store.addBudget({ campaignId: fSel.value, start: fStart.value, end: fEnd.value, amount: amount, memo: fMemo.value });
      if (!ui.report(res, '예산을 추가했어요.')) return;
      fAmount.value = ''; fMemo.value = '';
      fAmount.focus();
    });

    // ---------- 계산 ----------
    function items() {
      var s = store.get(), now = calc.today(), cur = ctx.current();
      return s.budgets.filter(function (b) { return cur === 'all' || b.campaignId === cur; }).map(function (b) {
        return { b: b, c: store.campaignById(b.campaignId), st: calc.budgetStatus(b, calc.spentFor(b, s.performance), now) };
      });
    }
    function visible() {
      var f = stateSel.value;
      return items().filter(function (x) { return f === 'all' || x.st.state === f; }).sort(function (a, c) {
        if (a.st.state !== c.st.state) return STATE_ORDER[a.st.state] - STATE_ORDER[c.st.state];
        return a.st.state === 'ended' ? (a.b.end < c.b.end ? 1 : -1) : (a.b.end < c.b.end ? -1 : 1);   // 곧 끝나는 것부터, 종료는 최근 것부터
      });
    }
    $('exportBtn').addEventListener('click', function () {
      var rows = visible();
      if (!rows.length) { ui.toast('내보낼 데이터가 없어요.', true); return; }
      var out = [['캠페인', '시작일', '종료일', '예산', '메모', '집행액', '소진율(%)']];
      rows.forEach(function (x) {
        out.push([x.c ? x.c.name : '', x.b.start, x.b.end, x.b.amount, x.b.memo, Math.round(x.st.spent), Math.round(x.st.usedPct * 10) / 10]);
      });
      ui.download('예산_' + ui.stamp() + '.csv', csv.toCSV(out), 'text/csv;charset=utf-8', true);
      ui.toast(rows.length + '행을 내보냈어요.');
    });

    // ---------- 그리기 ----------
    function bar(label, value, pct, cls) {
      return el('div', { class: 'bar-row' },
        el('div', { class: 'bar-row__head' }, el('span', { text: label }), el('span', { text: value })),
        el('div', { class: 'progress ' + (cls || ''), role: 'progressbar', 'aria-label': label, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(Math.min(100, pct))) },
          el('div', { class: 'progress__bar', style: 'width:' + Math.max(0, Math.min(100, pct)).toFixed(1) + '%' })));
    }
    function dt(label, value) { return [el('dt', { text: label }), el('dd', { text: value })]; }

    function card(x) {
      var b = x.b, st = x.st, c = x.c;
      var cls = st.over ? 'progress--over' : st.paceWarn ? 'progress--warn' : '';
      var chips = [el('span', { class: 'chip' + (st.state === 'running' ? ' chip--run' : ''), text: STATE_LABEL[st.state] })];
      if (st.over) chips.push(el('span', { class: 'chip chip--over', text: '예산 초과' }));
      else if (st.paceWarn) chips.push(el('span', { class: 'chip chip--warn', text: '속도 주의' }));

      var note = null;
      if (st.over) note = el('p', { class: 'bcard__note bcard__note--over', text: '예산을 ' + ui.fmtMoney(-st.remaining) + ' 초과했어요.' });
      else if (st.paceWarn) note = el('p', { class: 'bcard__note', text: '지금 속도면 기간 끝에 약 ' + ui.fmtMoney(st.projected) + '(예산의 ' + Math.round((st.projected / b.amount) * 100) + '%) 집행돼요. 남은 기간에는 하루 ' + ui.fmtMoney(st.suggestedDaily) + ' 이하를 권장해요.' });
      else if (st.state === 'before') note = el('p', { class: 'bcard__note', style: 'color:var(--muted)', text: '집행 시작까지 ' + calc.daysBetween(calc.today(), b.start) + '일 남았어요.' });

      return el('article', { class: 'bcard', 'data-c': c ? c.color : 'slate' },
        el('div', { class: 'bcard__head' },
          el('div', { class: 'bcard__title' }, c ? ui.badge(c) : null,
            el('strong', { text: b.memo || '예산' }),
            el('span', { class: 'muted small', text: b.start + ' ~ ' + b.end + ' (' + st.totalDays + '일)' })),
          el('div', { style: 'display:flex;flex-direction:column;gap:6px;align-items:flex-end' }, chips,
            el('button', { type: 'button', class: 'entry__del', 'data-id': b.id, 'aria-label': '예산 삭제', text: '삭제' }))),
        el('div', { class: 'bcard__amount', text: '예산 ' + ui.fmtMoney(b.amount) }),
        el('div', { class: 'bcard__bars' },
          bar('집행액', ui.fmtMoney(st.spent) + ' (' + ui.fmtPct(st.usedPct, 1) + ')', st.usedPct, cls),
          bar('기간 경과', st.elapsedDays + ' / ' + st.totalDays + '일 (' + ui.fmtPct(st.timePct, 1) + ')', st.timePct, 'progress--time')),
        el('dl', { class: 'bcard__grid' },
          dt('잔액', ui.fmtMoney(st.remaining)),
          dt('남은 일수', st.state === 'before' ? st.totalDays + '일 (시작 전)' : st.remainingDays + '일'),
          dt('일평균 집행', st.elapsedDays ? ui.fmtMoney(st.perDay) : '-'),
          dt(st.state === 'ended' ? '최종 집행액' : '예상 최종 집행액', st.state === 'before' ? '-' : ui.fmtMoney(st.projected))),
        note);
    }

    function renderGantt(rows) {
      gantt.replaceChildren();
      ganttCard.hidden = !rows.length;
      if (!rows.length) return;
      var byStart = rows.slice().sort(function (a, c) { return a.b.start < c.b.start ? -1 : a.b.start > c.b.start ? 1 : (a.b.end < c.b.end ? -1 : 1); });
      var min = byStart[0].b.start, max = byStart.reduce(function (m, x) { return x.b.end > m ? x.b.end : m; }, byStart[0].b.end);
      var today = calc.today(), span = calc.daysBetween(min, max) + 1;
      var pct = function (d) { return (calc.daysBetween(min, d) / span) * 100; };
      byStart.forEach(function (x) {
        var label = (x.c ? x.c.name : '') + (x.b.memo ? ' · ' + x.b.memo : '');
        var track = el('div', { class: 'gantt__track' },
          el('div', { class: 'gantt__bar', style: 'left:' + pct(x.b.start).toFixed(2) + '%;width:' + ((x.st.totalDays / span) * 100).toFixed(2) + '%',
            title: label + ' · ' + x.b.start + ' ~ ' + x.b.end }));
        if (today >= min && today <= max) track.append(el('div', { class: 'gantt__today', style: 'left:' + (((calc.daysBetween(min, today) + 0.5) / span) * 100).toFixed(2) + '%', title: '오늘 ' + today }));
        gantt.append(el('div', { class: 'gantt__row', 'data-c': x.c ? x.c.color : 'slate' }, el('div', { class: 'gantt__label', title: label, text: label }), track));
      });
      gantt.append(el('div', { class: 'gantt__axis' }, el('span'), el('div', {}, el('span', { text: min }), el('span', { text: '검은 선 = 오늘' }), el('span', { text: max }))));
    }

    function renderSummary(rows) {
      var amount = 0, spent = 0;
      rows.forEach(function (x) { amount += x.b.amount; spent += x.st.spent; });
      var tiles = [
        ['총 예산', ui.fmtMoney(amount), '예산 ' + rows.length + '건'],
        ['집행액', ui.fmtMoney(spent), '성과 탭의 비용 합계'],
        ['잔액', ui.fmtMoney(amount - spent), amount - spent < 0 ? '예산 초과' : ''],
        ['소진율', amount > 0 ? ui.fmtPct((spent / amount) * 100, 1) : '-', ''],
      ];
      summary.replaceChildren.apply(summary, tiles.map(function (x) {
        return el('div', { class: 'stat' }, el('div', { class: 'stat__label', text: x[0] }),
          el('div', { class: 'stat__value', text: x[1] }), el('div', { class: 'stat__sub', text: x[2] || ' ' }));
      }));
    }

    function hasOverlap(rows) {
      for (var i = 0; i < rows.length; i++) for (var j = i + 1; j < rows.length; j++) {
        var a = rows[i].b, c = rows[j].b;
        if (a.campaignId === c.campaignId && a.start <= c.end && c.start <= a.end) return true;
      }
      return false;
    }

    function renderAll() {
      var rows = visible();
      renderSummary(rows);
      overlap.hidden = !hasOverlap(rows);
      overlap.textContent = '같은 캠페인의 예산 기간이 겹쳐 있어요. 겹친 기간의 집행액은 각 예산에 중복으로 계산돼요.';
      renderGantt(rows);
      list.replaceChildren();
      if (!rows.length) {
        list.append(el('div', { class: 'empty', style: 'grid-column:1/-1', text: stateSel.value === 'all' ? '등록된 예산이 없어요. 위에서 “예산 추가”로 시작해 보세요.' : '이 상태의 예산이 없어요.' }));
        return;
      }
      rows.forEach(function (x) { list.append(card(x)); });
    }

    list.addEventListener('click', function (e) {
      var btn = e.target.closest('.entry__del');
      if (!btn) return;
      var b = store.get().budgets.find(function (x) { return x.id === btn.getAttribute('data-id'); });
      if (!b) return;
      var c = store.campaignById(b.campaignId);
      if (!confirm((c ? c.name : '') + ' ' + b.start + ' ~ ' + b.end + ' 예산을 삭제할까요?\n(성과 데이터는 지워지지 않아요)\n\n되돌릴 수 없어요.')) return;
      ui.report(store.deleteBudget(b.id), '삭제했어요.');
    });

    return {
      render: function () {
        var has = store.get().campaigns.length > 0;
        ctx.fillSelect(fSel);
        [fSel, fStart, fEnd, fAmount, fMemo, submit].forEach(function (n) { n.disabled = !has; });
        syncColor();
        if (!has) {
          summary.replaceChildren(); gantt.replaceChildren(); ganttCard.hidden = true; overlap.hidden = true;
          list.replaceChildren(ctx.emptyState());
          return;
        }
        if (!store.get().budgets.length) formCard.open = true;
        renderAll();
      },
    };
  };
})();
