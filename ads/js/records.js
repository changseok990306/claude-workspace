// (a) 기록장 — 캠페인별 날짜 메모, 날짜 최신순, 실시간 검색
(function () {
  'use strict';
  var A = window.Ads, calc = A.calc, store = A.store, ui = A.ui, el = ui.el;

  A.views.records = function (ctx, root) {
    root.innerHTML =
      '<form class="card composer" data-role="form" autocomplete="off">' +
        '<h2 class="card__title">기록 남기기</h2>' +
        '<div class="composer__row">' +
          '<label class="field"><span>캠페인</span><select data-role="campaign" required></select></label>' +
          '<label class="field"><span>날짜</span><input type="date" data-role="date" required></label>' +
        '</div>' +
        '<label class="field"><span>내용</span>' +
          '<textarea data-role="text" rows="3" maxlength="1000" required placeholder="어떤 일이 있었나요? (Ctrl+Enter 로 바로 추가)"></textarea></label>' +
        '<div class="composer__foot"><span class="muted small" data-role="chars">0 / 1000</span>' +
          '<button type="submit" class="btn btn--primary" data-role="submit">기록 추가</button></div>' +
      '</form>' +
      '<div class="searchbar">' +
        '<label class="search"><span class="visually-hidden">기록 검색</span>' +
          '<input type="search" data-role="q" placeholder="내용 또는 날짜로 검색  (예: 배너, 2026-11, 11월 8일)" autocomplete="off"></label>' +
        '<span class="muted small" data-role="result" aria-live="polite"></span>' +
      '</div>' +
      '<div class="timeline" data-role="timeline" aria-live="polite"></div>';

    function $(role) { return root.querySelector('[data-role="' + role + '"]'); }
    var form = $('form'), sel = $('campaign'), date = $('date'), text = $('text'),
        chars = $('chars'), submit = $('submit'), q = $('q'), result = $('result'), timeline = $('timeline');
    date.value = calc.today();
    var query = '';

    text.addEventListener('input', function () { chars.textContent = text.value.length + ' / 1000'; });
    text.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit(); }
    });
    sel.addEventListener('change', function () { form.setAttribute('data-c', colorOf(sel.value)); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var res = store.addHistory({ campaignId: sel.value, date: date.value, content: text.value });
      if (!ui.report(res, '기록했어요.')) return;
      text.value = ''; chars.textContent = '0 / 1000';
      text.focus();
    });

    q.addEventListener('input', function () { query = q.value; renderList(); });   // 한 글자마다 바로 걸러짐
    q.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && q.value) { q.value = ''; query = ''; renderList(); }
    });

    timeline.addEventListener('click', function (e) {
      var btn = e.target.closest('.entry__del');
      if (!btn) return;
      var h = store.get().histories.find(function (x) { return x.id === btn.getAttribute('data-id'); });
      if (!h) return;
      var preview = h.content.length > 40 ? h.content.slice(0, 40) + '…' : h.content;
      if (!confirm('이 기록을 삭제할까요?\n\n' + h.date + '  ' + preview + '\n\n되돌릴 수 없어요.')) return;
      ui.report(store.deleteHistory(h.id), '삭제했어요.');
    });

    function colorOf(id) { var c = store.campaignById(id); return c ? c.color : 'slate'; }

    function renderList() {
      var s = store.get(), toks = calc.tokensOf(query), cur = ctx.current();
      var list = s.histories.filter(function (h) {
        if (cur !== 'all' && h.campaignId !== cur) return false;
        if (!toks.length) return true;
        var c = store.campaignById(h.campaignId);
        return calc.matches(h.content + ' ' + calc.dateForms(h.date) + ' ' + (c ? c.name : ''), toks);
      }).sort(function (a, b) {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;                          // 날짜 최신순(위) → 오래될수록 아래
        if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;               // 같은 날은 나중에 쓴 것 먼저
        return a.id < b.id ? 1 : -1;
      });

      timeline.replaceChildren();
      result.textContent = (toks.length ? '검색 결과 ' : '') + list.length + '개';
      if (!list.length) {
        timeline.append(!s.campaigns.length ? ctx.emptyState()
          : el('div', { class: 'empty', text: toks.length ? '“' + query.trim() + '” 검색 결과가 없어요.' : '아직 기록이 없어요. 위에서 첫 기록을 남겨 보세요.' }));
        return;
      }
      var group = null, last = null;
      list.forEach(function (h) {
        if (h.date !== last) {
          last = h.date;
          group = el('div', { class: 'day__list' });
          timeline.append(el('section', { class: 'day' }, el('h3', { class: 'day__head', text: ui.fmtDate(h.date) }), group));
        }
        var c = store.campaignById(h.campaignId);
        var body = el('div', { class: 'entry__body' });
        if (cur === 'all' && c) body.append(ui.badge(c));
        var p = el('p', { class: 'entry__text' });
        p.append(ui.highlight(h.content, toks));
        body.append(p);
        group.append(el('article', { class: 'entry', 'data-c': colorOf(h.campaignId) }, body,
          el('button', { type: 'button', class: 'entry__del', 'data-id': h.id, 'aria-label': '이 기록 삭제', text: '삭제' })));
      });
    }

    return {
      render: function () {
        var has = store.get().campaigns.length > 0;
        ctx.fillSelect(sel);
        [sel, date, text, submit].forEach(function (n) { n.disabled = !has; });
        form.setAttribute('data-c', colorOf(sel.value));
        renderList();
      },
    };
  };
})();
