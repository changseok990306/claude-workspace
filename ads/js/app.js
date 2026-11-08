// 화면 전체 조율 — 탭, 캠페인 사이드바, 캠페인 추가/수정/삭제, 다크 모드
(function () {
  'use strict';
  var A = window.Ads, store = A.store, calc = A.calc, ui = A.ui, el = ui.el;

  function $(id) { return document.getElementById(id); }
  var TABS = {
    records: { label: '히스토리', sub: '캠페인별 변경·이슈·결정 기록', count: 'histories' },
    creatives: { label: '소재일정', sub: '소재 변경 일정 캘린더와 소재 점검', count: 'schedules' },
    tasks: { label: '체크리스트', sub: '매일 업무·기한 업무 체크 (공통 업무는 항상 표시)', count: 'tasks' },
  };
  var TAB_ORDER = ['records', 'creatives', 'tasks'];
  var UI_KEY = 'ads-ui-v1';

  var view = { tab: 'records', campaign: 'all' };
  var views = {};

  function save() { try { localStorage.setItem(UI_KEY, JSON.stringify({ campaign: view.campaign })); } catch (e) {} }
  (function restore() {
    try {
      var s = JSON.parse(localStorage.getItem(UI_KEY) || '{}');
      if (typeof s.campaign === 'string') view.campaign = s.campaign;
    } catch (e) {}
    var h = location.hash.replace('#', '');
    if (TABS[h]) view.tab = h;
  })();

  // ---------- 화면들이 함께 쓰는 도구 ----------
  function campaigns() { return store.get().campaigns; }
  function current() { return view.campaign !== 'all' && store.campaignById(view.campaign) ? view.campaign : 'all'; }

  var ctx = {
    current: current,
    // 입력창의 캠페인 선택칸을 채움. 사이드바에서 캠페인을 고르면 입력창도 그 캠페인으로 맞춰짐
    fillSelect: function (select) {
      var keep = select.value, cs = campaigns();
      select.replaceChildren();
      if (!cs.length) { select.append(el('option', { value: '', text: '캠페인을 먼저 만들어 주세요' })); return ''; }
      cs.forEach(function (c) { select.append(el('option', { value: c.id, text: c.name })); });
      var cur = current(), want = keep;
      if (cur === 'all') delete select.dataset.synced;
      else { if (select.dataset.synced !== cur) want = cur; select.dataset.synced = cur; }
      select.value = store.campaignById(want) ? want : cs[0].id;
      return select.value;
    },
    emptyState: function () {
      return el('div', { class: 'empty empty--welcome' },
        el('h2', { text: '먼저 캠페인을 만들어 주세요' }),
        el('p', { class: 'muted', text: '캠페인이 모든 히스토리·소재일정의 기준이에요. 처음이라면 예시 데이터로 먼저 둘러볼 수도 있어요.' }),
        el('div', { class: 'empty__actions' },
          el('button', { type: 'button', class: 'btn btn--primary', text: '+ 새 캠페인', on: { click: function () { openCampaignDialog(null); } } }),
          el('button', { type: 'button', class: 'btn', text: '예시 데이터로 둘러보기', on: { click: function () { A.data && A.data.addSample(ctx); } } }),
          el('button', { type: 'button', class: 'btn', text: 'CSV 가져오기', on: { click: function () { ctx.openData({ section: 'import' }); } } })));
    },
    openData: function (opts) { if (A.data) A.data.open(ctx, opts || {}); },
    setCampaign: function (id) { view.campaign = id; save(); render(); },
  };

  // ---------- 테마 ----------
  var themeSwitch = $('themeSwitch');
  function applyTheme(t, persist) {
    document.documentElement.dataset.theme = t;
    themeSwitch.setAttribute('aria-checked', String(t === 'dark'));
    if (persist) { try { localStorage.setItem('theme', t); } catch (e) {} }
  }
  themeSwitch.addEventListener('click', function () {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true);
  });
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light', false);
  // 첫 화면은 애니메이션 없이, 이후 전환부터 부드럽게
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { document.documentElement.classList.add('theme-ready'); });
  });

  // ---------- 알림 띠 (저장이 안 될 때) ----------
  // 안내 띠: 서버 연결 문제(sync)와 브라우저 저장 문제(storage)를 따로 관리해서 함께 보여 줌
  var banners = { storage: '', sync: '' };
  function renderBanner() {
    var b = $('banner'), msg = [banners.sync, banners.storage].filter(Boolean).join('  ');
    b.textContent = msg; b.hidden = !msg;
  }
  function applyStorageBanner() {
    var s = store.status();
    // 서버 모드에서는 데이터가 서버에 있으므로 브라우저 저장 공간 문제는 중요하지 않음
    banners.storage = store.mode() === 'server' ? '' :
      !s.storageOk ? '이 브라우저에서는 데이터를 저장할 수 없어요 (사생활 보호 모드 등). 지금 입력한 내용은 창을 닫으면 사라지니, 데이터 메뉴에서 백업을 받아 두세요.' :
      s.loadWarning || '';
    renderBanner();
  }
  store.onSaveError(function () {
    if (store.mode() === 'server') return;
    banners.storage = '저장 공간이 가득 찼거나 쓸 수 없어요. 지금 내용은 화면에만 있으니 데이터 메뉴에서 백업(JSON)을 먼저 받아 두세요.';
    renderBanner();
  });

  // ---------- 저장 위치 · 동기화 상태 표시 (우측 상단) ----------
  var syncEl = $('syncState');
  function renderSync(s) {
    var text = '', cls = 'sync', title = '';
    if (s.mode === 'local') {
      text = '이 브라우저에만 저장'; cls += ' sync--local';
      title = '이 주소에는 공유 저장소(서버)가 연결되어 있지 않아, 입력한 내용이 이 브라우저에만 저장돼요. 다른 컴퓨터에서는 보이지 않아요.';
    } else if (s.mode === 'error') {
      text = '공유 저장소 연결 안 됨'; cls += ' sync--error'; title = s.message;
    } else if (s.state === 'synced') {
      text = '공유 저장소 연결됨'; cls += ' sync--ok'; title = '입력한 내용이 서버에 저장되고, 다른 사람의 변경도 자동으로 반영돼요.';
    } else if (s.state === 'offline') {
      text = '연결 끊김' + (s.pending ? ' · ' + s.pending + '건 대기' : ''); cls += ' sync--bad'; title = s.message;
    } else if (s.state === 'error') {
      text = '일부 저장 실패'; cls += ' sync--error'; title = s.message;
    } else {
      text = '저장 중…'; cls += ' sync--busy'; title = '서버와 맞추는 중이에요.';
    }
    syncEl.textContent = text; syncEl.className = cls; syncEl.title = title; syncEl.hidden = false;
    banners.sync = (s.mode === 'error' ? s.message + ' 지금 입력한 내용은 이 브라우저에만 저장돼요.' : s.mode === 'server' && s.state === 'error' ? s.message : '');
    renderBanner();
  }
  A.sync.onStatus(renderSync);

  // ---------- 탭 ----------
  var tabButtons = Array.prototype.slice.call(document.querySelectorAll('.tab'));
  function go(tab) {
    if (!TABS[tab]) return;
    view.tab = tab;
    if (location.hash !== '#' + tab) history.replaceState(null, '', '#' + tab);
    render();
  }
  tabButtons.forEach(function (b, i) {
    b.addEventListener('click', function () { go(b.getAttribute('data-tab')); });
    b.addEventListener('keydown', function (e) {      // 좌우 화살표로 탭 이동
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      var n = tabButtons[(i + d + tabButtons.length) % tabButtons.length];
      n.focus(); go(n.getAttribute('data-tab'));
    });
  });
  window.addEventListener('hashchange', function () {
    var h = location.hash.replace('#', '');
    if (TABS[h]) { if (h !== view.tab) { view.tab = h; render(); } }
    else go('records');       // 알 수 없는 주소(예전 #performance 등)·빈 주소(로고 클릭)는 첫 탭으로
  });

  // ---------- 사이드바 ----------
  var list = $('campaignList');
  function countFor(id) {
    var rows = store.get()[TABS[view.tab].count];
    return id === 'all' ? rows.length : rows.filter(function (r) { return r.campaignId === id; }).length;
  }
  function renderSidebar() {
    list.replaceChildren();
    function item(id, name, color) {
      var b = el('button', { type: 'button', class: 'campaign', 'data-id': id, 'data-c': color },
        el('span', { class: 'campaign__dot', 'aria-hidden': 'true' }),
        el('span', { class: 'campaign__name', text: name }),
        el('span', { class: 'campaign__count', text: String(countFor(id)) }));
      if (current() === id) b.setAttribute('aria-current', 'true');
      list.append(el('li', {}, b));
    }
    item('all', '전체', 'all');
    campaigns().forEach(function (c) { item(c.id, c.name, c.color); });
  }
  list.addEventListener('click', function (e) {
    var b = e.target.closest('.campaign');
    if (b) ctx.setCampaign(b.getAttribute('data-id'));
  });

  function renderTitle() {
    var c = current() === 'all' ? null : store.campaignById(current());
    $('pageTitle').setAttribute('data-c', c ? c.color : 'all');
    $('titleText').textContent = c ? c.name : '전체 캠페인';
    $('titleSub').textContent = TABS[view.tab].label + ' · ' + TABS[view.tab].sub;
    $('titleActions').hidden = !c;
  }

  // ---------- 캠페인 추가 / 수정 / 삭제 ----------
  var dlg = $('campaignDialog'), editingId = null;
  function buildSwatches(selected) {
    var box = $('cdColors');
    box.replaceChildren();
    store.COLORS.forEach(function (p) {
      var input = el('input', { type: 'radio', name: 'cdColor', value: p[0], 'aria-label': p[1] });
      if (p[0] === selected) input.checked = true;
      box.append(el('label', { class: 'swatch', 'data-c': p[0], title: p[1] }, input, el('span')));
    });
  }
  function openCampaignDialog(c) {
    editingId = c ? c.id : null;
    $('cdTitle').textContent = c ? '캠페인 수정' : '새 캠페인';
    $('cdName').value = c ? c.name : '';
    buildSwatches(c ? c.color : store.nextColor());    // 새로 만들 땐 안 쓴 색을 먼저 추천
    dlg.showModal();
    $('cdName').focus();
  }
  $('newCampaignBtn').addEventListener('click', function () { openCampaignDialog(null); });
  $('editCampaignBtn').addEventListener('click', function () { var c = store.campaignById(current()); if (c) openCampaignDialog(c); });
  $('cdCancel').addEventListener('click', function () { dlg.close(); });
  $('campaignForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var checked = $('cdColors').querySelector('input:checked');
    var body = { name: $('cdName').value, color: checked ? checked.value : 'indigo' };
    var res = editingId ? store.updateCampaign(editingId, body) : store.addCampaign(body);
    if (!ui.report(res, editingId ? '수정했어요.' : '캠페인을 만들었어요.')) return;
    dlg.close();
    if (!editingId) ctx.setCampaign(res.item.id);
  });
  $('deleteCampaignBtn').addEventListener('click', function () {
    var c = store.campaignById(current());
    if (!c) return;
    var s = store.get(), n = function (k) { return s[k].filter(function (x) { return x.campaignId === c.id; }).length; };
    if (!confirm('“' + c.name + '” 캠페인과 그 안의 히스토리 ' + n('histories') + '개, 소재 ' + n('creatives') +
      '개, 일정 ' + n('schedules') + '개, 업무 ' + n('tasks') + '개가 모두 삭제돼요. (어느 캠페인에도 속하지 않은 공통 업무는 남아요.)\n\n이 작업은 되돌릴 수 없어요. (데이터 메뉴에서 백업을 받아 두면 안전해요)\n진행할까요?')) return;
    var res = store.deleteCampaign(c.id);
    if (ui.report(res, '삭제했어요.')) ctx.setCampaign('all');
  });

  $('dataBtn').addEventListener('click', function () { ctx.openData({}); });

  // ---------- 그리기 ----------
  function render() {
    tabButtons.forEach(function (b) {
      var on = b.getAttribute('data-tab') === view.tab;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    TAB_ORDER.forEach(function (t) { $('view-' + t).hidden = t !== view.tab; });
    renderSidebar();
    renderTitle();
    var root = $('view-' + view.tab);
    if (!views[view.tab]) {
      views[view.tab] = A.views[view.tab] ? A.views[view.tab](ctx, root)
        : { render: function () { root.textContent = '준비 중이에요.'; } };
    }
    views[view.tab].render();
  }
  store.subscribe(render);

  // 서버 확인(+ 첫 데이터 받기)이 끝나면 첫 화면을 그림. 기다리는 동안에는 "불러오는 중" 화면
  var bootEl = $('boot');
  var ready = A.sync.start();
  if (A.sync.isAsync()) bootEl.hidden = false;
  ready.then(function () {
    bootEl.hidden = true;
    applyStorageBanner();
    renderSync(A.sync.status());
    render();
    document.documentElement.dataset.ready = '1';       // 검사 도구가 "첫 화면이 그려졌는지" 알 수 있게
  });
})();
