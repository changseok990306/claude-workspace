// (d) 소재·체크리스트 — 광고 소재를 상태(준비/집행 중/종료)별로 관리하고 점검 항목을 체크
(function () {
  'use strict';
  var A = window.Ads, calc = A.calc, store = A.store, ui = A.ui, el = ui.el;

  A.views.creatives = function (ctx, root) {
    root.innerHTML =
      '<div class="toolbar">' +
        '<label class="field"><span>종류</span><select data-role="type"><option value="all">전체</option></select></label>' +
      '</div>' +
      '<details class="card details" data-role="formCard"><summary>소재 추가</summary>' +
        '<form data-role="form" autocomplete="off" style="display:flex;flex-direction:column;gap:14px">' +
          '<div class="form-grid">' +
            '<label class="field"><span>캠페인</span><select data-role="fCampaign" required></select></label>' +
            '<label class="field"><span>소재 이름</span><input type="text" maxlength="80" data-role="fTitle" required placeholder="예: 메인 배너 A (1200×628)"></label>' +
            '<label class="field"><span>종류</span><select data-role="fType"></select></label>' +
            '<label class="field"><span>상태</span><select data-role="fStatus"></select></label>' +
          '</div>' +
          '<label class="field"><span>메모 (선택)</span><textarea data-role="fMemo" rows="2" maxlength="300" placeholder="예: 자막 최종본 대기"></textarea></label>' +
          '<div class="composer__foot">' +
            '<label class="checkline"><input type="checkbox" data-role="fCheck" checked> 기본 점검 항목 5개 함께 추가 (규격·문구·링크·UTM·승인)</label>' +
            '<button type="submit" class="btn btn--primary" data-role="submit">소재 추가</button></div>' +
        '</form>' +
      '</details>' +
      '<div class="searchbar">' +
        '<label class="search"><span class="visually-hidden">소재 검색</span>' +
          '<input type="search" data-role="q" placeholder="소재 이름·메모·점검 항목으로 검색" autocomplete="off"></label>' +
        '<span class="muted small" data-role="result" aria-live="polite"></span>' +
      '</div>' +
      '<div class="board" data-role="board"></div>';

    function $(r) { return root.querySelector('[data-role="' + r + '"]'); }
    var typeSel = $('type'), formCard = $('formCard'), form = $('form'), fSel = $('fCampaign'), fTitle = $('fTitle'),
        fType = $('fType'), fStatus = $('fStatus'), fMemo = $('fMemo'), fCheck = $('fCheck'), submit = $('submit'),
        q = $('q'), result = $('result'), board = $('board');
    var refocus = null;

    store.TYPES.forEach(function (t) {
      typeSel.append(el('option', { value: t, text: t }));
      fType.append(el('option', { value: t, text: t }));
    });
    store.STATUSES.forEach(function (s) { fStatus.append(el('option', { value: s[0], text: s[1] })); });

    typeSel.addEventListener('change', renderBoard);
    q.addEventListener('input', renderBoard);
    q.addEventListener('keydown', function (e) { if (e.key === 'Escape' && q.value) { q.value = ''; renderBoard(); } });
    fSel.addEventListener('change', syncColor);
    function syncColor() {
      var c = store.campaignById(fSel.value);
      formCard.setAttribute('data-c', c ? c.color : 'slate');
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var res = store.addCreative({ campaignId: fSel.value, title: fTitle.value, type: fType.value, status: fStatus.value,
        memo: fMemo.value, withChecklist: fCheck.checked });
      if (!ui.report(res, '소재를 추가했어요.')) return;
      fTitle.value = ''; fMemo.value = '';
      fTitle.focus();
    });

    // ---------- 그리기 ----------
    function visible() {
      var toks = calc.tokensOf(q.value), cur = ctx.current(), type = typeSel.value;
      return {
        toks: toks,
        list: store.get().creatives.filter(function (c) {
          if (cur !== 'all' && c.campaignId !== cur) return false;
          if (type !== 'all' && c.type !== type) return false;
          if (!toks.length) return true;
          var camp = store.campaignById(c.campaignId);
          var hay = [c.title, c.memo, c.type, camp ? camp.name : ''].concat(c.checklist.map(function (k) { return k.text; })).join(' ');
          return calc.matches(hay, toks);
        }).sort(function (a, b) { return b.createdAt - a.createdAt; }),
      };
    }

    function card(c, toks) {
      var camp = store.campaignById(c.campaignId), pr = calc.checklistProgress(c);
      var title = el('div', { class: 'ccard__title' }); title.append(ui.highlight(c.title, toks));
      var memo = null;
      if (c.memo) { memo = el('p', { class: 'ccard__memo' }); memo.append(ui.highlight(c.memo, toks)); }

      var checks = el('ul', { class: 'checks' }, c.checklist.map(function (k) {
        var box = el('input', { type: 'checkbox', 'data-kid': k.id, 'aria-label': k.text });
        box.checked = k.done;
        return el('li', { class: k.done ? 'done' : '' }, el('label', {}, box, el('span', { text: k.text })),
          el('button', { type: 'button', class: 'x', 'data-kid': k.id, 'aria-label': '“' + k.text + '” 항목 삭제', text: '✕' }));
      }));

      var status = el('select', { 'aria-label': '상태 변경' });
      store.STATUSES.forEach(function (s) { status.append(el('option', { value: s[0], text: s[1] })); });
      status.value = c.status;

      return el('article', { class: 'ccard', 'data-c': camp ? camp.color : 'slate', 'data-cid': c.id },
        el('div', { class: 'ccard__top' }, camp ? ui.badge(camp) : null, el('span', { class: 'chip', text: c.type })),
        title, memo,
        pr.total ? el('div', { class: 'bar-row' },
          el('div', { class: 'bar-row__head' }, el('span', { text: '점검' }), el('span', { text: pr.done + ' / ' + pr.total + (pr.done === pr.total ? ' 완료' : '') })),
          el('div', { class: 'progress ' + (pr.done === pr.total ? '' : 'progress--time'), role: 'progressbar', 'aria-label': '점검 진행률', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(pr.pct)) },
            el('div', { class: 'progress__bar', style: 'width:' + pr.pct.toFixed(1) + '%' }))) : null,
        checks,
        el('form', { class: 'checkadd', autocomplete: 'off' },
          el('input', { type: 'text', maxlength: '100', placeholder: '점검 항목 추가', 'aria-label': '점검 항목 추가' }),
          el('button', { type: 'submit', class: 'btn btn--sm', text: '추가' })),
        el('div', { class: 'ccard__foot' }, status,
          el('button', { type: 'button', class: 'entry__del cdel', 'aria-label': '소재 삭제', text: '삭제' })));
    }

    function renderBoard() {
      var v = visible();
      result.textContent = (v.toks.length ? '검색 결과 ' : '') + v.list.length + '개';
      board.replaceChildren();
      store.STATUSES.forEach(function (s) {
        var items = v.list.filter(function (c) { return c.status === s[0]; });
        board.append(el('section', { class: 'col', 'aria-label': s[1] },
          el('div', { class: 'col__head' }, el('h2', { text: s[1] }), el('span', { text: String(items.length) })),
          items.length ? items.map(function (c) { return card(c, v.toks); })
            : el('div', { class: 'empty', text: '없음' })));
      });
      if (refocus) {
        var inp = board.querySelector('[data-cid="' + refocus + '"] .checkadd input');
        if (inp) inp.focus();
        refocus = null;
      }
    }

    // 이벤트는 보드 하나에서 받아서 처리 (카드가 다시 그려져도 계속 동작)
    board.addEventListener('change', function (e) {
      var card = e.target.closest('.ccard');
      if (!card) return;
      var id = card.getAttribute('data-cid');
      if (e.target.matches('input[type=checkbox]')) ui.report(store.toggleCheck(id, e.target.getAttribute('data-kid')));
      else if (e.target.matches('.ccard__foot select')) ui.report(store.updateCreative(id, { status: e.target.value }));
    });
    board.addEventListener('click', function (e) {
      var card = e.target.closest('.ccard');
      if (!card) return;
      var id = card.getAttribute('data-cid');
      if (e.target.closest('.x')) {
        ui.report(store.removeCheck(id, e.target.closest('.x').getAttribute('data-kid')));
      } else if (e.target.closest('.cdel')) {
        var c = store.creativeById(id);
        if (c && confirm('“' + c.title + '” 소재를 삭제할까요?\n(점검 항목도 함께 지워져요)\n\n되돌릴 수 없어요.')) ui.report(store.deleteCreative(id), '삭제했어요.');
      }
    });
    board.addEventListener('submit', function (e) {
      e.preventDefault();
      var card = e.target.closest('.ccard');
      if (!card) return;
      var input = e.target.querySelector('input');
      var id = card.getAttribute('data-cid');
      refocus = id;
      if (!ui.report(store.addCheck(id, input.value))) refocus = null;
    });

    return {
      render: function () {
        var has = store.get().campaigns.length > 0;
        ctx.fillSelect(fSel);
        [fSel, fTitle, fType, fStatus, fMemo, fCheck, submit].forEach(function (n) { n.disabled = !has; });
        syncColor();
        if (!has) {
          board.replaceChildren(ctx.emptyState()); result.textContent = '';
          return;
        }
        if (!store.get().creatives.length) formCard.open = true;
        renderBoard();
      },
    };
  };
})();
