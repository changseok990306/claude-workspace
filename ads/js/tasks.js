// 체크리스트 탭 — 히스토리·소재 일정 외의 일반 업무(매일 업무 + 기한 업무 + 기한 없는 업무)를 날짜별로 확인하며 체크
(function () {
  'use strict';
  var A = window.Ads, calc = A.calc, store = A.store, ui = A.ui, el = ui.el;

  var WEEK = ['일', '월', '화', '수', '목', '금', '토'];
  function wk(iso) { return WEEK[new Date(iso + 'T00:00:00Z').getUTCDay()]; }
  function md(iso) { return Number(iso.slice(5, 7)) + '월 ' + Number(iso.slice(8)) + '일 (' + wk(iso) + ')'; }
  function shortMd(iso) { return Number(iso.slice(5, 7)) + '/' + Number(iso.slice(8)); }

  // 화면에서 고르는 종류 (저장 종류: daily / weekdays / once)
  var KINDS = [
    ['daily', '매일 반복'], ['weekdays', '평일만 반복 (월~금)'], ['deadline', '기한 업무 (마감일까지)'], ['nodue', '기한 없음'],
  ];
  var HINTS = {
    daily: '매일 해야 하는 업무예요. 날짜마다 따로 체크해요.',
    weekdays: '월~금요일에만 나타나는 업무예요. 날짜마다 따로 체크해요.',
    deadline: '마감일까지 해야 하는 업무예요. 시작일을 넣으면 그 기간 동안 “오늘 할 일”에 나오고, 마감이 지나면 “지연”으로 표시돼요.',
    nodue: '날짜 없이 쌓아 두는 업무예요.',
  };

  A.views.tasks = function (ctx, root) {
    root.innerHTML =
      '<section class="card tday" aria-label="날짜별 진행 상황">' +
        '<div class="tday__head">' +
          '<div><h2 class="tday__title" data-role="t-title"></h2><p class="muted small" data-role="t-sub"></p></div>' +
          '<div class="cal__nav">' +
            '<button type="button" class="btn btn--sm" data-role="t-prev" aria-label="전날">‹</button>' +
            '<button type="button" class="btn btn--sm" data-role="t-today">오늘</button>' +
            '<button type="button" class="btn btn--sm" data-role="t-next" aria-label="다음 날">›</button>' +
            '<input type="date" class="tday__date" data-role="t-day" aria-label="날짜 선택">' +
          '</div>' +
        '</div>' +
        '<div class="tprog">' +
          '<div class="progress" role="progressbar" aria-label="진행률" aria-valuemin="0" aria-valuemax="100" data-role="t-progress"><div class="progress__bar" data-role="t-bar"></div></div>' +
          '<span class="tprog__text" data-role="t-prog" aria-live="polite"></span>' +
        '</div>' +
      '</section>' +

      '<details class="card details" data-role="t-formCard"><summary data-role="t-formTitle">업무 추가</summary>' +
        '<form class="tform" data-role="t-form" autocomplete="off">' +
          '<div class="form-grid">' +
            '<label class="field tform__wide"><span>업무 이름</span><input type="text" maxlength="80" required data-role="t-ttl" placeholder="예: 광고 성과 리포트 확인"></label>' +
            '<label class="field"><span>종류</span><select data-role="t-kind"></select></label>' +
            '<label class="field"><span>캠페인</span><select data-role="t-campaign"></select></label>' +
          '</div>' +
          '<div class="form-grid">' +
            '<label class="field" data-role="t-startWrap"><span data-role="t-startLabel">시작일</span><input type="date" data-role="t-start"></label>' +
            '<label class="field" data-role="t-dueWrap"><span data-role="t-dueLabel">마감일</span><input type="date" data-role="t-due"></label>' +
          '</div>' +
          '<label class="field"><span>메모 (선택)</span><input type="text" maxlength="300" data-role="t-memo" placeholder="예: 전일 노출·클릭·비용 확인"></label>' +
          '<div class="composer__foot"><span class="muted small" data-role="t-hint"></span>' +
            '<div class="drow"><button type="button" class="btn" data-role="t-cancel" hidden>수정 취소</button>' +
              '<button type="submit" class="btn btn--primary" data-role="t-submit">업무 추가</button></div></div>' +
        '</form>' +
      '</details>' +

      '<div class="searchbar">' +
        '<label class="search"><span class="visually-hidden">업무 검색</span>' +
          '<input type="search" data-role="t-q" placeholder="업무 이름·메모로 검색" autocomplete="off"></label>' +
        '<span class="muted small" data-role="t-result" aria-live="polite"></span>' +
      '</div>' +
      '<div class="tsections" data-role="t-sections"></div>';

    function $(r) { return root.querySelector('[data-role="' + r + '"]'); }
    var title = $('t-title'), sub = $('t-sub'), dayInput = $('t-day'), bar = $('t-bar'), progress = $('t-progress'), prog = $('t-prog'),
        formCard = $('t-formCard'), formTitle = $('t-formTitle'), form = $('t-form'), fTtl = $('t-ttl'), fKind = $('t-kind'),
        fCamp = $('t-campaign'), fStart = $('t-start'), fDue = $('t-due'), fMemo = $('t-memo'), hint = $('t-hint'),
        submit = $('t-submit'), cancel = $('t-cancel'), q = $('t-q'), result = $('t-result'), sections = $('t-sections');

    KINDS.forEach(function (k) { fKind.append(el('option', { value: k[0], text: k[1] })); });

    var st = { day: calc.today(), editId: null };
    var auto = false, touched = false;       // 업무가 하나도 없으면 폼을 자동으로 펼침(직접 접으면 존중)
    formCard.addEventListener('toggle', function () { if (auto) { auto = false; return; } touched = true; });

    // ---------- 날짜 이동 ----------
    function setDay(iso) { if (calc.validDate(iso)) { st.day = iso; render(); } }
    $('t-prev').addEventListener('click', function () { setDay(calc.addDays(st.day, -1)); });
    $('t-next').addEventListener('click', function () { setDay(calc.addDays(st.day, 1)); });
    $('t-today').addEventListener('click', function () { setDay(calc.today()); });
    dayInput.addEventListener('change', function () { setDay(dayInput.value); });

    // ---------- 데이터 ----------
    function visibleTasks() {       // 왼쪽에서 고른 캠페인의 업무 + 공통 업무(어느 캠페인을 골라도 항상 보임)
      var cur = ctx.current();
      return store.get().tasks.filter(function (t) { return cur === 'all' || t.campaignId === '' || t.campaignId === cur; });
    }
    function isDoneOn(t, day) { return t.kind === 'once' ? t.done : t.doneDates.indexOf(day) !== -1; }
    function campOf(t) { return t.campaignId ? store.campaignById(t.campaignId) : null; }

    // ---------- 폼 ----------
    function uiKindOf(t) { return t.kind === 'once' ? (t.due ? 'deadline' : 'nodue') : t.kind; }
    function applyKind() {
      var k = fKind.value, rec = k === 'daily' || k === 'weekdays';
      $('t-startWrap').hidden = !(rec || k === 'deadline');
      $('t-dueWrap').hidden = !(rec || k === 'deadline');
      $('t-startLabel').textContent = rec ? '시작일' : '시작일 (선택)';
      $('t-dueLabel').textContent = rec ? '종료일 (선택)' : '마감일';
      fStart.required = rec;
      fDue.required = k === 'deadline';
      if (rec && !fStart.value) fStart.value = calc.today();
      hint.textContent = HINTS[k];
    }
    fKind.addEventListener('change', applyKind);

    function fillCampaign() {
      var keep = fCamp.value, cur = ctx.current();
      fCamp.replaceChildren(el('option', { value: '', text: '공통 업무 (캠페인 없음)' }));
      store.get().campaigns.forEach(function (c) { fCamp.append(el('option', { value: c.id, text: c.name })); });
      var want = keep;
      if (cur === 'all') delete fCamp.dataset.synced;
      else { if (fCamp.dataset.synced !== cur) want = cur; fCamp.dataset.synced = cur; }
      fCamp.value = want === '' || store.campaignById(want) ? want : '';
      var c = store.campaignById(fCamp.value);
      formCard.setAttribute('data-c', c ? c.color : 'slate');
    }
    fCamp.addEventListener('change', function () { var c = store.campaignById(fCamp.value); formCard.setAttribute('data-c', c ? c.color : 'slate'); });

    function payload() {
      var k = fKind.value, rec = k === 'daily' || k === 'weekdays';
      return {
        title: fTtl.value, kind: rec ? k : 'once', campaignId: fCamp.value, memo: fMemo.value,
        start: k === 'nodue' ? '' : fStart.value, due: k === 'nodue' ? '' : fDue.value,
      };
    }
    function endEdit() {
      st.editId = null;
      formTitle.textContent = '업무 추가'; submit.textContent = '업무 추가'; cancel.hidden = true;
      fTtl.value = ''; fMemo.value = '';
    }
    function startEdit(t) {
      st.editId = t.id;
      formTitle.textContent = '업무 수정'; submit.textContent = '저장'; cancel.hidden = false;
      fTtl.value = t.title; fMemo.value = t.memo; fKind.value = uiKindOf(t);
      fCamp.value = t.campaignId; fStart.value = t.start; fDue.value = t.due;
      applyKind();
      if (!formCard.open) { auto = true; formCard.open = true; }
      formCard.setAttribute('data-c', (campOf(t) || { color: 'slate' }).color);
      formCard.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      fTtl.focus();
    }
    cancel.addEventListener('click', endEdit);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var editing = st.editId;
      var res = editing ? store.updateTask(editing, payload()) : store.addTask(payload());
      if (!ui.report(res, editing ? '업무를 수정했어요.' : '업무를 추가했어요.')) return;
      if (editing) endEdit();
      else { fTtl.value = ''; fMemo.value = ''; fTtl.focus(); }
    });

    // ---------- 한 줄 ----------
    function item(t, toks) {
      var c = campOf(t), cur = ctx.current(), day = st.day, done = isDoneOn(t, day);
      var box = el('input', { type: 'checkbox', 'aria-label': (done ? '완료 취소: ' : '완료: ') + t.title });
      box.checked = done;
      var ttl = el('div', { class: 'sitem__title' }); ttl.append(ui.highlight(t.title, toks));
      var memo = null;
      if (t.memo) { memo = el('p', { class: 'sitem__memo' }); memo.append(ui.highlight(t.memo, toks)); }

      var chips = [];
      if (t.kind === 'daily' || t.kind === 'weekdays') {
        chips.push(el('span', { class: 'chip', text: t.kind === 'daily' ? '매일' : '평일' }));
        if (t.due) chips.push(el('span', { class: 'sitem__date', text: '~ ' + shortMd(t.due) + ' 까지' }));
      } else if (t.done) {
        chips.push(el('span', { class: 'chip chip--run', text: '완료 ' + (t.doneAt ? shortMd(t.doneAt) : '') }));
        if (t.due) chips.push(el('span', { class: 'sitem__date', text: '마감 ' + shortMd(t.due) }));
      } else if (t.due) {
        var n = calc.daysBetween(day, t.due);
        chips.push(el('span', { class: 'chip' + (n < 0 ? ' chip--over' : n === 0 ? ' chip--warn' : ''), text: calc.dueLabel(day, t.due) }));
        chips.push(el('span', { class: 'sitem__date', text: (t.start ? shortMd(t.start) + ' ~ ' : '마감 ') + shortMd(t.due) }));
      } else {
        chips.push(el('span', { class: 'chip', text: '기한 없음' }));
      }
      if (cur === 'all' && c) chips.push(ui.badge(c));
      else if (!c) chips.push(el('span', { class: 'chip', text: '공통' }));

      return el('div', { class: 'sitem titem', 'data-c': c ? c.color : 'slate', 'data-done': done ? '1' : '0', 'data-id': t.id },
        el('label', { class: 'sitem__check', title: done ? '완료 취소' : '완료' }, box),
        el('div', { class: 'sitem__body' }, el('div', { class: 'sitem__top' }, chips), ttl, memo),
        el('div', { class: 'sitem__actions' },
          el('button', { type: 'button', class: 'entry__del tedit', 'aria-label': '수정: ' + t.title, text: '수정' }),
          el('button', { type: 'button', class: 'entry__del tdel', 'aria-label': '삭제: ' + t.title, text: '삭제' })));
    }

    function section(label, tone, list, toks, emptyText) {
      var head = el('h3', { class: 'tsec__title', text: label }, el('span', { class: 'tsec__count', text: String(list.length) }));
      var body = list.length ? list.map(function (t) { return item(t, toks); }) : (emptyText ? el('div', { class: 'empty', text: emptyText }) : null);
      return el('section', { class: 'card tsec tsec--' + tone }, head, el('div', { class: 'slist' }, body));
    }

    // ---------- 그리기 ----------
    function renderSections(all) {
      var day = st.day, toks = calc.tokensOf(q.value);
      var list = all.filter(function (t) {
        if (!toks.length) return true;
        var c = campOf(t);
        return calc.matches(t.title + ' ' + t.memo + ' ' + (c ? c.name : '공통'), toks);
      });
      var b = { overdue: [], today: [], recurring: [], upcoming: [], nodue: [], done: [] };
      list.forEach(function (t) { var k = calc.taskBucket(t, day); if (k) b[k].push(t); });
      var byDue = function (x, y) { return (x.due || '9') < (y.due || '9') ? -1 : (x.due || '9') > (y.due || '9') ? 1 : x.createdAt - y.createdAt; };
      b.overdue.sort(byDue); b.today.sort(byDue); b.upcoming.sort(byDue);
      b.recurring.sort(function (x, y) { return x.createdAt - y.createdAt; });
      b.nodue.sort(function (x, y) { return x.createdAt - y.createdAt; });
      b.done.sort(function (x, y) { return (y.doneAt || '') < (x.doneAt || '') ? -1 : 1; });

      sections.replaceChildren();
      result.textContent = (toks.length ? '검색 결과 ' : '') + list.length + '건';
      if (!store.get().tasks.length) {
        sections.append(el('div', { class: 'empty', text: '아직 업무가 없어요. 위의 “업무 추가”에서 매일 하는 업무와 마감이 있는 업무를 적어 보세요.' }));
        return;
      }
      if (b.overdue.length) sections.append(section('지연된 업무', 'overdue', b.overdue, toks));
      sections.append(section(day === calc.today() ? '오늘 할 일' : md(day) + ' 할 일', 'today', b.recurring.concat(b.today), toks,
        toks.length ? '검색 결과가 없어요.' : '이 날 해야 할 업무가 없어요.'));
      if (b.upcoming.length) sections.append(section('예정된 업무', 'upcoming', b.upcoming, toks));
      if (b.nodue.length) sections.append(section('기한 없는 업무', 'nodue', b.nodue, toks));
      if (b.done.length) {
        var d = el('details', { class: 'card tsec tsec--done' },
          el('summary', {}, '완료한 업무 ', el('span', { class: 'tsec__count', text: String(b.done.length) })),
          el('div', { class: 'slist', style: 'margin-top:12px' }, b.done.slice(0, 50).map(function (t) { return item(t, toks); })));
        if (toks.length) d.open = true;
        sections.append(d);
      }
      if (!list.length && toks.length) sections.replaceChildren(el('div', { class: 'empty', text: '“' + q.value.trim() + '” 검색 결과가 없어요.' }));
    }

    function renderHead(all) {
      var day = st.day, t0 = calc.today(), p = calc.dayProgress(all, day);
      title.textContent = (day === t0 ? '오늘 · ' : '') + md(day);
      dayInput.value = day;
      var overdue = 0, dueToday = 0, soon = 0;
      all.forEach(function (t) {
        var k = calc.taskBucket(t, day);
        if (k === 'overdue') overdue++;
        else if (k === 'today' && t.due === day) dueToday++;
        else if (k === 'upcoming' && t.due && calc.daysBetween(day, t.due) <= 7) soon++;
      });
      var parts = [];
      if (day !== t0) { var gap = calc.daysBetween(t0, day); parts.push(gap > 0 ? '오늘로부터 ' + gap + '일 후' : '오늘로부터 ' + (-gap) + '일 전'); }
      if (overdue) parts.push('지연 ' + overdue + '건');
      if (dueToday) parts.push('오늘 마감 ' + dueToday + '건');
      if (soon) parts.push('7일 안 마감 ' + soon + '건');
      sub.textContent = parts.join(' · ') || '지연되거나 임박한 마감이 없어요.';
      bar.style.width = p.pct.toFixed(1) + '%';
      progress.setAttribute('aria-valuenow', String(Math.round(p.pct)));
      progress.className = 'progress' + (p.total && p.done === p.total ? ' progress--ok' : '');
      prog.textContent = p.total ? p.done + ' / ' + p.total + ' 완료 (' + Math.round(p.pct) + '%)' + (p.done === p.total ? ' · 모두 끝냈어요!' : '') : '이 날은 해야 할 업무가 없어요';
    }

    q.addEventListener('input', function () { renderSections(visibleTasks()); });
    q.addEventListener('keydown', function (e) { if (e.key === 'Escape' && q.value) { q.value = ''; renderSections(visibleTasks()); } });

    sections.addEventListener('change', function (e) {
      var row = e.target.closest('.titem');
      if (!row || !e.target.matches('input[type=checkbox]')) return;
      var t = store.taskById(row.getAttribute('data-id'));
      if (t) ui.report(store.toggleTask(t.id, t.kind === 'once' ? calc.today() : st.day));
    });
    sections.addEventListener('click', function (e) {
      var row = e.target.closest('.titem');
      if (!row) return;
      var t = store.taskById(row.getAttribute('data-id'));
      if (!t) return;
      if (e.target.closest('.tedit')) startEdit(t);
      else if (e.target.closest('.tdel')) {
        if (!confirm('“' + t.title + '” 업무를 삭제할까요?\n(체크한 기록도 함께 지워져요)\n\n되돌릴 수 없어요.')) return;
        if (st.editId === t.id) endEdit();
        ui.report(store.deleteTask(t.id), '삭제했어요.');
      }
    });

    function render() {
      fillCampaign();
      applyKind();
      var all = visibleTasks();
      renderHead(all);
      renderSections(all);
      if (!store.get().tasks.length && !st.editId && !touched && !formCard.open) { auto = true; formCard.open = true; }
    }

    return { render: render };
  };
})();
