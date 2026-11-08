// 데이터 창 — 히스토리 CSV 가져오기(미리보기 후 적용) · CSV 내보내기 · 전체 백업/복원 · 예시 데이터 · 전체 삭제
(function () {
  'use strict';
  var A = window.Ads, csv = A.csv, store = A.store, ui = A.ui, el = ui.el;

  var MAX_CSV = 2 * 1024 * 1024, MAX_JSON = 10 * 1024 * 1024;
  var TYPE = 'histories';

  function campName(id) { var c = store.campaignById(id); return c ? c.name : ''; }

  // 내보내기용 표 (날짜 최신순)
  function exportRows() {
    var out = [['날짜', '캠페인', '내용']];
    store.get().histories.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }).forEach(function (h) {
      out.push([h.date, campName(h.campaignId), h.content]);
    });
    return out;
  }

  function addSample(ctx) {
    var res = store.addSample(A.buildSample());
    if (ui.report(res, '예시 데이터를 추가했어요. “예시 ·”로 시작하는 캠페인을 삭제하면 함께 지워져요.')) ctx && ctx.setCampaign('all');
    return res.ok;
  }

  function open(ctx, opts) {
    var dlg = document.getElementById('dataDialog');
    var rawText = null, mapped = null, backupPreview = null;

    // ----- CSV 가져오기 영역 -----
    var auto = el('input', { type: 'checkbox', id: 'ddAuto' }); auto.checked = true;
    var file = el('input', { type: 'file', accept: '.csv,.txt,text/csv', 'aria-label': 'CSV 파일 선택' });
    var preview = el('div', { class: 'preview', hidden: true, 'aria-live': 'polite' });
    var applyBtn = el('button', { type: 'button', class: 'btn btn--primary', text: '가져오기', disabled: true });

    function newNames(items) {      // 파일에 있지만 아직 없는 캠페인 이름
      var have = store.get().campaigns.map(function (c) { return c.name.toLowerCase(); }), out = [];
      items.forEach(function (it) {
        var k = it.campaignName.toLowerCase();
        if (have.indexOf(k) === -1 && out.map(function (x) { return x.toLowerCase(); }).indexOf(k) === -1) out.push(it.campaignName);
      });
      return out;
    }

    function renderPreview() {
      preview.replaceChildren();
      applyBtn.disabled = true;
      if (rawText === null) { preview.hidden = true; return; }
      preview.hidden = false;
      mapped = csv.mapRows(TYPE, csv.parse(rawText));
      if (mapped.fatal) { preview.append(el('div', { class: 'bad', text: mapped.fatal })); return; }

      var items = mapped.items, errs = mapped.errors, names = newNames(items);
      preview.append(el('div', { class: items.length ? 'ok' : 'bad', text: items.length + '행을 가져올 수 있어요.' + (errs.length ? ' (오류 ' + errs.length + '행은 건너뛰어요)' : '') }));
      if (names.length) {
        preview.append(el('div', { text: auto.checked
          ? '새 캠페인 ' + names.length + '개가 자동으로 만들어져요: ' + names.slice(0, 8).join(', ') + (names.length > 8 ? ' 외 ' + (names.length - 8) + '개' : '')
          : '목록에 없는 캠페인 이름이 있는 행은 건너뛰어요: ' + names.slice(0, 8).join(', ') }));
      }
      if (errs.length) {
        preview.append(el('div', { class: 'bad', text: '확인이 필요한 줄' }),
          el('ul', {}, errs.slice(0, 10).map(function (e) { return el('li', { text: e.line + '줄: ' + e.message }); }),
            errs.length > 10 ? el('li', { text: '… 외 ' + (errs.length - 10) + '개' }) : null));
      }
      applyBtn.disabled = items.length === 0;
    }

    function readCsv() {
      var f = file.files && file.files[0];
      if (!f) { rawText = null; renderPreview(); return; }
      ui.readText(f, MAX_CSV).then(function (text) { rawText = text; renderPreview(); })
        .catch(function (e) { rawText = null; preview.hidden = false; preview.replaceChildren(el('div', { class: 'bad', text: e.message })); applyBtn.disabled = true; });
    }
    file.addEventListener('change', readCsv);
    auto.addEventListener('change', renderPreview);

    applyBtn.addEventListener('click', function () {
      if (!mapped || mapped.fatal || !mapped.items.length) return;
      var res = store.addHistories(mapped.items, { autoCreate: auto.checked });
      var msg = '히스토리 ' + res.added + '건 추가' + (res.skipped ? ', ' + res.skipped + '건 건너뜀' : '');
      if (res.created.length) msg += ' · 새 캠페인 ' + res.created.length + '개';
      if (res.saved === false) { ui.toast('저장 공간에 쓰지 못했어요. 백업을 먼저 받아 두세요.', true); return; }
      ui.toast(msg + ' 했어요.');
      rawText = null; mapped = null; file.value = '';
      preview.hidden = false; applyBtn.disabled = true;
      preview.replaceChildren(el('div', { class: 'ok', text: msg + ' 했어요.' }));
    });

    // ----- 백업 복원 영역 -----
    var jsonFile = el('input', { type: 'file', accept: '.json,application/json', 'aria-label': '백업 JSON 파일 선택' });
    var jsonPrev = el('div', { class: 'preview', hidden: true, 'aria-live': 'polite' });
    var restoreBtn = el('button', { type: 'button', class: 'btn btn--danger', text: '이 백업으로 바꾸기', disabled: true });
    jsonFile.addEventListener('change', function () {
      backupPreview = null; restoreBtn.disabled = true; jsonPrev.replaceChildren();
      var f = jsonFile.files && jsonFile.files[0];
      if (!f) { jsonPrev.hidden = true; return; }
      jsonPrev.hidden = false;
      ui.readText(f, MAX_JSON).then(function (text) {
        var pv = store.previewBackup(text);
        if (!pv.ok) { jsonPrev.append(el('div', { class: 'bad', text: pv.error })); return; }
        backupPreview = pv;
        var c = pv.counts;
        jsonPrev.append(el('div', { class: 'ok', text: '읽을 수 있는 백업이에요.' }),
          el('div', { text: '캠페인 ' + c.campaigns + ' · 히스토리 ' + c.histories + ' · 소재 ' + c.creatives + ' · 일정 ' + c.schedules }),
          pv.hasRemoved ? el('div', { class: 'muted', text: '이 백업에 들어 있던 성과·예산 데이터는 지금 버전에서 지원하지 않아 제외돼요.' }) : null,
          el('div', { class: 'muted', text: '지금 들어 있는 데이터는 모두 이 내용으로 바뀌어요.' }));
        restoreBtn.disabled = false;
      }).catch(function (e) { jsonPrev.append(el('div', { class: 'bad', text: e.message })); });
    });
    restoreBtn.addEventListener('click', function () {
      if (!backupPreview) return;
      if (!confirm('지금 데이터가 모두 사라지고 백업 내용으로 바뀌어요.\n\n되돌릴 수 없어요. 진행할까요?')) return;
      if (ui.report(store.replaceAll(backupPreview.data), '백업에서 복원했어요.')) { ctx.setCampaign('all'); dlg.close(); }
    });

    // ----- 구성 -----
    function btn(label, fn) { return el('button', { type: 'button', class: 'btn btn--sm', text: label, on: { click: fn } }); }

    dlg.replaceChildren(el('div', { style: 'display:flex;flex-direction:column;gap:18px' },
      el('h2', { id: 'ddTitle', text: '데이터 관리' }),

      el('section', { class: 'dsec', id: 'ddImport' },
        el('h3', { text: '히스토리 CSV 가져오기' }),
        el('p', { class: 'muted small', text: '엑셀·구글 시트에서 “CSV로 저장”한 파일을 올려요. 열은 날짜 · 캠페인 · 내용이고, 첫 줄은 열 이름이어야 해요(한글/영어 모두 알아봐요). 파일은 이 브라우저 안에서만 읽고 어디에도 올라가지 않아요.' }),
        el('div', { class: 'drow' }, btn('양식 CSV 받기', function () {
          ui.download(csv.SCHEMAS[TYPE].label + '_양식.csv', csv.toCSV(csv.template(TYPE)), 'text/csv;charset=utf-8', true);
        })),
        el('div', { class: 'drow' }, file),
        el('label', { class: 'checkline', for: 'ddAuto' }, auto, '파일에 있는 새 캠페인 이름은 자동으로 만들기'),
        preview,
        el('div', { class: 'drow' }, applyBtn)),

      el('section', { class: 'dsec' },
        el('h3', { text: '히스토리 CSV 내보내기' }),
        el('p', { class: 'muted small', text: '엑셀에서 한글이 깨지지 않게 저장돼요. 내보낸 파일은 그대로 다시 가져올 수 있어요.' }),
        el('div', { class: 'drow' }, btn('히스토리 내보내기', function () {
          var rows = exportRows();
          if (rows.length < 2) { ui.toast('내보낼 데이터가 없어요.', true); return; }
          ui.download('히스토리_' + ui.stamp() + '.csv', csv.toCSV(rows), 'text/csv;charset=utf-8', true);
          ui.toast((rows.length - 1) + '행을 내보냈어요.');
        }))),

      el('section', { class: 'dsec' },
        el('h3', { text: '전체 백업 · 복원 (JSON)' }),
        el('p', { class: 'muted small', text: '모든 데이터(캠페인·히스토리·소재·소재 변경 일정)를 파일 하나로 저장해요. 데이터는 이 브라우저에만 있으니 가끔 백업해 두세요. 브라우저 데이터를 지우면 함께 사라져요.' }),
        el('div', { class: 'drow' }, btn('백업 파일 받기', function () {
          ui.download('어도비_백업_' + ui.stamp() + '.json', store.exportJSON(), 'application/json;charset=utf-8', false);
          ui.toast('백업 파일을 저장했어요.');
        })),
        el('div', { class: 'drow' }, jsonFile), jsonPrev, el('div', { class: 'drow' }, restoreBtn)),

      el('section', { class: 'dsec' },
        el('h3', { text: '예시 데이터' }),
        el('p', { class: 'muted small', text: '화면을 둘러보기 위한 가짜 데이터(캠페인 3개)를 지금 데이터에 추가해요. “예시 ·”로 시작하는 캠페인을 삭제하면 함께 지워져요.' }),
        el('div', { class: 'drow' }, btn('예시 데이터 추가', function () { addSample(ctx); }))),

      el('section', { class: 'dsec' },
        el('h3', { text: '전체 삭제' }),
        el('p', { class: 'muted small', text: '이 브라우저에 저장된 모든 데이터를 지워요. 되돌릴 수 없으니 먼저 백업 파일을 받아 두세요.' }),
        el('div', { class: 'drow' }, el('button', { type: 'button', class: 'btn btn--sm btn--danger', text: '모든 데이터 지우기', on: { click: function () {
          var n = store.counts();
          var answer = prompt('캠페인 ' + n.campaigns + '개와 그 안의 모든 데이터가 삭제돼요.\n되돌릴 수 없어요.\n\n정말 지우려면 “삭제”라고 입력하세요.');
          if (answer !== '삭제') { if (answer !== null) ui.toast('입력이 달라서 취소했어요.'); return; }
          if (ui.report(store.clearAll(), '모든 데이터를 지웠어요.')) { ctx.setCampaign('all'); dlg.close(); }
        } } }))),

      el('div', { class: 'dialog__foot' }, el('button', { type: 'button', class: 'btn btn--primary', text: '닫기', on: { click: function () { dlg.close(); } } }))));

    if (!dlg.open) dlg.showModal();
    if (opts.section === 'import') { var sec = document.getElementById('ddImport'); if (sec) sec.scrollIntoView({ block: 'start' }); file.focus(); }
  }

  A.data = { open: open, addSample: addSample, exportRows: exportRows };
})();
