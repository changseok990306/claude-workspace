// 소재 변경 일정 — 맨 위 월 달력(일정 있는 날 강조) + 선택한 날짜의 일정/추가 + 전체 일정 목록(확인 완료 체크)
(function () {
  'use strict';
  var A = window.Ads, calc = A.calc, store = A.store, ui = A.ui, el = ui.el;

  var WEEK = ['일', '월', '화', '수', '목', '금', '토'];
  var MAX_CHIPS = 2;            // 칸 하나에 보여 줄 일정 칩 수 (나머지는 "+N건")

  function typeInfo(key) {
    return store.SCHEDULE_TYPES.find(function (p) { return p[0] === key; }) || store.SCHEDULE_TYPES[0];
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function monthLabel(iso) { return iso.slice(0, 4) + '년 ' + Number(iso.slice(5, 7)) + '월'; }
  function dayLabel(iso) { return ui.fmtDate(iso); }
  // 한 달 앞뒤로 이동하되 일(day)은 유지 (그 달에 없으면 말일)
  function shiftMonth(iso, n) {
    var first = calc.addMonths(iso, n), last = Number(calc.monthEnd(first).slice(8));
    return first.slice(0, 8) + pad(Math.min(Number(iso.slice(8)), last));
  }

  A.views.schedule = function (ctx, root) {
    root.innerHTML =
      '<div data-role="s-empty" hidden></div>' +
      '<div class="sched" data-role="s-main">' +
        '<section class="card cal" aria-label="소재 변경 일정 캘린더">' +
          '<div class="cal__head">' +
            '<h2 class="cal__title" data-role="s-title" aria-live="polite"></h2>' +
            '<div class="cal__nav">' +
              '<button type="button" class="btn btn--sm" data-role="s-prev" aria-label="이전 달">‹</button>' +
              '<button type="button" class="btn btn--sm" data-role="s-today">오늘</button>' +
              '<button type="button" class="btn btn--sm" data-role="s-next" aria-label="다음 달">›</button>' +
            '</div>' +
          '</div>' +
          '<div class="cal__dow" aria-hidden="true"></div>' +
          '<div class="cal__grid" role="group" aria-label="날짜 선택 (화살표 키로 이동)" data-role="s-grid"></div>' +
          '<p class="cal__legend muted small">칸 색이 진한 날 = 일정이 있는 날 · 칩 색 = 캠페인 · ↻ 교체 · ＋ 신규 오픈 · ■ 종료 · ✓ 점검 · 흐린 칩 = 확인 완료</p>' +
        '</section>' +

        '<section class="card" data-role="s-day">' +
          '<h2 class="card__title" data-role="s-dayTitle"></h2>' +
          '<div class="slist" data-role="s-dayList"></div>' +
          '<form class="sform" data-role="s-form" autocomplete="off">' +
            '<h3 class="sform__title">이 날짜에 일정 추가</h3>' +
            '<div class="form-grid">' +
              '<label class="field"><span>캠페인</span><select data-role="s-campaign" required></select></label>' +
              '<label class="field"><span>날짜</span><input type="date" data-role="s-date" required></label>' +
              '<label class="field"><span>종류</span><select data-role="s-type"></select></label>' +
            '</div>' +
            '<div class="form-grid sform__row2">' +
              '<label class="field"><span>소재 변경 내용</span><input type="text" maxlength="80" data-role="s-ttl" required placeholder="예: 메인 배너 A → B 교체"></label>' +
              '<label class="field"><span>메모 (선택)</span><input type="text" maxlength="300" data-role="s-memo" placeholder="예: 자막 최종본 확인 후"></label>' +
            '</div>' +
            '<div class="composer__foot"><span class="muted small">달력에서 날짜를 누르면 날짜가 자동으로 들어가요.</span>' +
              '<button type="submit" class="btn btn--primary" data-role="s-submit">일정 추가</button></div>' +
          '</form>' +
        '</section>' +

        '<section class="card" data-role="s-all">' +
          '<h2 class="card__title">소재 변경 일정 목록</h2>' +
          '<div class="toolbar">' +
            '<label class="field"><span>범위</span><select data-role="s-range">' +
              '<option value="upcoming">오늘 이후 (예정)</option><option value="past">지난 일정</option><option value="all">전체</option></select></label>' +
            '<label class="field"><span>확인</span><select data-role="s-state">' +
              '<option value="all">전체</option><option value="todo">미완료</option><option value="done">확인 완료</option></select></label>' +
            '<label class="field" style="flex:1;min-width:180px"><span>검색</span>' +
              '<input type="search" data-role="s-q" placeholder="내용·메모·날짜로 검색 (예: 배너, 11월 8일)" autocomplete="off"></label>' +
          '</div>' +
          '<p class="muted small" data-role="s-result" aria-live="polite" style="margin:10px 0"></p>' +
          '<div class="slist" data-role="s-list"></div>' +
        '</section>' +
      '</div>';

    function $(r) { return root.querySelector('[data-role="' + r + '"]'); }
    var emptyHost = $('s-empty'), main = $('s-main'), title = $('s-title'), grid = $('s-grid'),
        dayTitle = $('s-dayTitle'), dayList = $('s-dayList'), form = $('s-form'), fCamp = $('s-campaign'),
        fDate = $('s-date'), fType = $('s-type'), fTitle = $('s-ttl'), fMemo = $('s-memo'), submit = $('s-submit'),
        range = $('s-range'), stateSel = $('s-state'), q = $('s-q'), result = $('s-result'), list = $('s-list');

    var dow = root.querySelector('.cal__dow');
    WEEK.forEach(function (w, i) { dow.append(el('div', { class: 'cal__w' + (i === 0 ? ' is-sun' : i === 6 ? ' is-sat' : ''), text: w })); });
    store.SCHEDULE_TYPES.forEach(function (t) { fType.append(el('option', { value: t[0], text: t[2] + ' ' + t[1] })); });

    var today0 = calc.today();
    var st = { selected: today0, month: calc.monthStart(today0) };
    fDate.value = st.selected;

    // ---------- 데이터 ----------
    function events() {      // 왼쪽에서 고른 캠페인만 (전체면 모두)
      var cur = ctx.current();
      return store.get().schedules.filter(function (x) { return cur === 'all' || x.campaignId === cur; });
    }
    function byDate(evs) {
      var m = {};
      evs.forEach(function (x) { (m[x.date] = m[x.date] || []).push(x); });
      Object.keys(m).forEach(function (k) { m[k].sort(function (a, b) { return a.createdAt - b.createdAt; }); });
      return m;
    }

    // ---------- 선택 / 이동 ----------
    function select(iso, opts) {
      opts = opts || {};
      st.selected = iso;
      st.month = calc.monthStart(iso);
      if (!opts.fromForm) fDate.value = iso;
      render();
      if (opts.focus) { var c = grid.querySelector('[data-date="' + iso + '"]'); if (c) c.focus(); }
    }
    $('s-prev').addEventListener('click', function () { select(shiftMonth(st.selected, -1)); });
    $('s-next').addEventListener('click', function () { select(shiftMonth(st.selected, 1)); });
    $('s-today').addEventListener('click', function () { select(calc.today()); });

    grid.addEventListener('click', function (e) {
      var b = e.target.closest('.cal__day');
      if (b) select(b.getAttribute('data-date'));
    });
    grid.addEventListener('dblclick', function (e) {      // 두 번 누르면 바로 내용 입력으로
      if (e.target.closest('.cal__day')) fTitle.focus();
    });
    grid.addEventListener('keydown', function (e) {       // 화살표: 날짜 이동 · PageUp/Down: 달 이동
      var b = e.target.closest('.cal__day');
      if (!b) return;
      var d = st.selected, next = null;
      if (e.key === 'ArrowLeft') next = calc.addDays(d, -1);
      else if (e.key === 'ArrowRight') next = calc.addDays(d, 1);
      else if (e.key === 'ArrowUp') next = calc.addDays(d, -7);
      else if (e.key === 'ArrowDown') next = calc.addDays(d, 7);
      else if (e.key === 'PageUp') next = shiftMonth(d, -1);
      else if (e.key === 'PageDown') next = shiftMonth(d, 1);
      else if (e.key === 'Home') next = calc.addDays(d, -new Date(d + 'T00:00:00Z').getUTCDay());
      else if (e.key === 'End') next = calc.addDays(d, 6 - new Date(d + 'T00:00:00Z').getUTCDay());
      if (next) { e.preventDefault(); select(next, { focus: true }); }
    });

    // 날짜 칸을 직접 바꾸면 달력도 그 날짜로
    fDate.addEventListener('change', function () { if (calc.validDate(fDate.value)) select(fDate.value, { fromForm: true }); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var res = store.addSchedule({ campaignId: fCamp.value, date: fDate.value, type: fType.value, title: fTitle.value, memo: fMemo.value });
      if (!ui.report(res, '일정을 추가했어요.')) return;
      fTitle.value = ''; fMemo.value = '';
      select(res.item.date, { fromForm: true });
      fTitle.focus();
    });

    // ---------- 달력 그리기 ----------
    function chipFor(x) {
      var c = store.campaignById(x.campaignId), t = typeInfo(x.type);
      return el('span', { class: 'cal__chip', 'data-c': c ? c.color : 'slate', 'data-done': x.done ? '1' : '0', title: (c ? c.name + ' · ' : '') + t[1] + ' · ' + x.title },
        el('i', { 'aria-hidden': 'true', text: t[2] }), x.title);
    }
    function dotFor(x) {
      var c = store.campaignById(x.campaignId);
      return el('span', { class: 'cal__dot', 'data-c': c ? c.color : 'slate', 'data-done': x.done ? '1' : '0' });
    }

    function renderCalendar(map) {
      var g = calc.monthGrid(st.month), t = calc.today();
      title.textContent = monthLabel(g.first);
      grid.replaceChildren();
      var focusable = g.weeks.some(function (w) { return w.indexOf(st.selected) !== -1; }) ? st.selected : g.first;
      g.weeks.forEach(function (week) {
        week.forEach(function (iso, i) {
          var evs = map[iso] || [], other = iso.slice(0, 7) !== g.month;
          var cls = 'cal__day' + (other ? ' is-other' : '') + (iso === t ? ' is-today' : '') + (iso === st.selected ? ' is-selected' : '') +
            (evs.length ? ' has-events' : '') + (i === 0 ? ' is-sun' : i === 6 ? ' is-sat' : '');
          var open = evs.filter(function (x) { return !x.done; }).length;
          var label = Number(iso.slice(5, 7)) + '월 ' + Number(iso.slice(8)) + '일 ' + WEEK[i] + '요일' + (iso === t ? ', 오늘' : '') +
            (evs.length ? ', 일정 ' + evs.length + '건' + (open < evs.length ? ' (확인 완료 ' + (evs.length - open) + '건)' : '') : ', 일정 없음');
          var cell = el('button', { type: 'button', class: cls, 'data-date': iso, 'aria-label': label, 'aria-pressed': String(iso === st.selected), tabindex: iso === focusable ? '0' : '-1' },
            el('span', { class: 'cal__num', text: String(Number(iso.slice(8))) }),
            el('span', { class: 'cal__events' }, evs.slice(0, MAX_CHIPS).map(chipFor),
              evs.length > MAX_CHIPS ? el('span', { class: 'cal__more', text: '+' + (evs.length - MAX_CHIPS) + '건' }) : null),
            evs.length ? el('span', { class: 'cal__dots', 'aria-hidden': 'true' }, evs.slice(0, 4).map(dotFor)) : null);
          grid.append(cell);
        });
      });
    }

    // ---------- 일정 한 줄 ----------
    function item(x, o) {
      o = o || {};
      var c = store.campaignById(x.campaignId), t = typeInfo(x.type), cur = ctx.current();
      var box = el('input', { type: 'checkbox', 'aria-label': '확인 완료: ' + x.title });
      box.checked = x.done;
      var ttl = el('div', { class: 'sitem__title' }); ttl.append(ui.highlight(x.title, o.toks || []));
      var memo = null;
      if (x.memo) { memo = el('p', { class: 'sitem__memo' }); memo.append(ui.highlight(x.memo, o.toks || [])); }
      return el('div', { class: 'sitem', 'data-c': c ? c.color : 'slate', 'data-done': x.done ? '1' : '0', 'data-id': x.id },
        el('label', { class: 'sitem__check', title: '확인 완료' }, box),
        el('div', { class: 'sitem__body' },
          el('div', { class: 'sitem__top' },
            o.showDate ? el('span', { class: 'sitem__date', text: Number(x.date.slice(5, 7)) + '월 ' + Number(x.date.slice(8)) + '일 (' + WEEK[new Date(x.date + 'T00:00:00Z').getUTCDay()] + ')' }) : null,
            o.showDate ? el('span', { class: 'chip', text: calc.ddayLabel(calc.today(), x.date) }) : null,
            cur === 'all' && c ? ui.badge(c) : null,
            el('span', { class: 'chip sitem__type', text: t[2] + ' ' + t[1] })),
          ttl, memo),
        el('button', { type: 'button', class: 'entry__del sdel', 'aria-label': '일정 삭제: ' + x.title, text: '삭제' }));
    }

    function renderDay(map) {
      var evs = map[st.selected] || [];
      dayTitle.textContent = dayLabel(st.selected) + ' · 일정 ' + evs.length + '건';
      dayList.replaceChildren();
      if (!evs.length) { dayList.append(el('div', { class: 'empty', text: '이 날짜에는 일정이 없어요. 아래에서 추가해 보세요.' })); return; }
      evs.forEach(function (x) { dayList.append(item(x)); });
    }

    function renderList(evs) {
      var toks = calc.tokensOf(q.value), t = calc.today();
      var rows = evs.filter(function (x) {
        if (range.value === 'upcoming' && x.date < t) return false;
        if (range.value === 'past' && x.date >= t) return false;
        if (stateSel.value === 'todo' && x.done) return false;
        if (stateSel.value === 'done' && !x.done) return false;
        if (!toks.length) return true;
        var c = store.campaignById(x.campaignId);
        return calc.matches([x.title, x.memo, typeInfo(x.type)[1], c ? c.name : '', calc.dateForms(x.date)].join(' '), toks);
      });
      rows.sort(function (a, b) {
        if (a.date !== b.date) return (range.value === 'past' ? -1 : 1) * (a.date < b.date ? -1 : 1);     // 예정·전체는 가까운 날짜 먼저, 지난 일정은 최근 것 먼저
        return a.createdAt - b.createdAt;
      });
      result.textContent = (toks.length ? '검색 결과 ' : '') + rows.length + '건';
      list.replaceChildren();
      if (!rows.length) {
        list.append(el('div', { class: 'empty', text: toks.length ? '“' + q.value.trim() + '” 검색 결과가 없어요.' : range.value === 'upcoming' ? '예정된 일정이 없어요.' : '조건에 맞는 일정이 없어요.' }));
        return;
      }
      rows.forEach(function (x) { list.append(item(x, { showDate: true, toks: toks })); });
    }

    [range, stateSel].forEach(function (n) { n.addEventListener('change', function () { renderList(events()); }); });
    q.addEventListener('input', function () { renderList(events()); });
    q.addEventListener('keydown', function (e) { if (e.key === 'Escape' && q.value) { q.value = ''; renderList(events()); } });

    // 체크 / 삭제 (달력 아래 두 목록 모두)
    function onChange(e) {
      var row = e.target.closest('.sitem');
      if (row && e.target.matches('input[type=checkbox]')) ui.report(store.toggleSchedule(row.getAttribute('data-id')));
    }
    function onClick(e) {
      var btn = e.target.closest('.sdel');
      if (!btn) return;
      var x = store.scheduleById(btn.closest('.sitem').getAttribute('data-id'));
      if (!x) return;
      if (!confirm('이 일정을 삭제할까요?\n\n' + x.date + '  ' + x.title + '\n\n되돌릴 수 없어요.')) return;
      ui.report(store.deleteSchedule(x.id), '삭제했어요.');
    }
    [dayList, list].forEach(function (n) { n.addEventListener('change', onChange); n.addEventListener('click', onClick); });

    return {
      render: render,
    };

    function render() {
      var has = store.get().campaigns.length > 0;
      emptyHost.hidden = has;
      main.hidden = !has;
      if (!has) { emptyHost.replaceChildren(ctx.emptyState()); return; }
      ctx.fillSelect(fCamp);
      var c = store.campaignById(fCamp.value);
      form.setAttribute('data-c', c ? c.color : 'slate');
      fCamp.onchange = function () { var k = store.campaignById(fCamp.value); form.setAttribute('data-c', k ? k.color : 'slate'); };
      var evs = events(), map = byDate(evs);
      renderCalendar(map);
      renderDay(map);
      renderList(evs);
    }
  };
})();
