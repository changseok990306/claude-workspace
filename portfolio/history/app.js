// 캠페인 히스토리 화면 동작
// 사용자가 입력한 글은 전부 textContent / createTextNode 로만 출력합니다 (HTML 로 해석 안 됨).
(function () {
  'use strict';

  var COLORS = [
    ['indigo', '인디고'], ['teal', '청록'], ['amber', '호박'], ['rose', '장미'],
    ['green', '초록'], ['violet', '보라'], ['orange', '주황'], ['slate', '회색'],
  ];
  var WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

  var state = { campaigns: [], histories: [], current: 'all', query: '' };

  function $(id) { return document.getElementById(id); }
  var ui = {
    app: $('app'), themeSwitch: $('themeSwitch'),
    loadError: $('loadError'), loadErrorMsg: $('loadErrorMsg'), retryBtn: $('retryBtn'),
    campaignList: $('campaignList'), newCampaignBtn: $('newCampaignBtn'),
    pageTitle: $('pageTitle'), titleText: $('titleText'), titleSub: $('titleSub'),
    titleActions: $('titleActions'), editCampaignBtn: $('editCampaignBtn'), deleteCampaignBtn: $('deleteCampaignBtn'),
    composer: $('composer'), cSelect: $('cSelect'), cDate: $('cDate'), cText: $('cText'),
    cCount: $('cCount'), cSubmit: $('cSubmit'),
    q: $('q'), resultCount: $('resultCount'), timeline: $('timeline'),
    campaignDialog: $('campaignDialog'), campaignForm: $('campaignForm'), cdTitle: $('cdTitle'),
    cdName: $('cdName'), cdColors: $('cdColors'), cdCancel: $('cdCancel'),
    toast: $('toast'),
  };

  // ---------- 작은 도우미 ----------
  function el(tag, props) {
    var n = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      if (k === 'text') n.textContent = props[k];
      else if (k === 'class') n.className = props[k];
      else n.setAttribute(k, props[k]);
    });
    for (var i = 2; i < arguments.length; i++) if (arguments[i] != null) n.append(arguments[i]);
    return n;
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function todayIso() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function fmtDate(iso) {
    var p = iso.split('-').map(Number);
    var wd = WEEKDAYS[new Date(p[0], p[1] - 1, p[2]).getDay()];
    return p[0] + '년 ' + p[1] + '월 ' + p[2] + '일 (' + wd + ')';
  }
  function campaignById(id) {
    return state.campaigns.find(function (c) { return c.id === id; });
  }
  function colorOf(id) {
    var c = campaignById(id);
    return c ? c.color : 'slate';
  }
  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  var toastTimer;
  function toast(msg, isError) {
    ui.toast.textContent = msg;
    ui.toast.className = 'toast' + (isError ? ' toast--error' : '');
    ui.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { ui.toast.hidden = true; }, 3200);
  }

  function store(key, val) { try { localStorage.setItem(key, val); } catch (e) {} }
  function load(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }

  function handleError(e) {
    toast((e && e.message) || '문제가 생겼어요.', true);
  }

  // ---------- 테마 ----------
  function applyTheme(t, save) {
    document.documentElement.dataset.theme = t;
    ui.themeSwitch.setAttribute('aria-checked', String(t === 'dark'));
    if (save) store('theme', t);
  }
  ui.themeSwitch.addEventListener('click', function () {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true);
  });
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light', false);
  // 첫 화면은 애니메이션 없이, 이후 전환부터 부드럽게
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { document.documentElement.classList.add('theme-ready'); });
  });

  function sortHistories() {
    state.histories.sort(function (a, b) {
      if (a.event_date !== b.event_date) return a.event_date < b.event_date ? 1 : -1;      // 날짜 최신순
      if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;      // 같은 날은 나중에 쓴 것 먼저
      return b.id - a.id;
    });
  }

  async function loadAll() {
    var res = await Promise.all([Api.listCampaigns(), Api.listHistories()]);
    state.campaigns = res[0].items;
    state.histories = res[1].items;
    sortHistories();
    var saved = load('current');
    state.current = saved && campaignById(saved) ? saved : 'all';
  }

  function showApp() {
    ui.app.hidden = false;
    ui.loadError.hidden = true;
    ui.cDate.value = ui.cDate.value || todayIso();
    render();
    selectComposerCampaign(state.current !== 'all' ? state.current : null);
  }

  // ---------- 그리기 ----------
  function render() {
    renderSidebar();
    renderTitle();
    renderComposerOptions();
    renderTimeline();
  }

  function countFor(id) {
    if (id === 'all') return state.histories.length;
    return state.histories.filter(function (h) { return h.campaign_id === id; }).length;
  }

  function renderSidebar() {
    ui.campaignList.replaceChildren();
    function item(id, name, color) {
      var btn = el('button', { type: 'button', class: 'campaign', 'data-id': id, 'data-c': color },
        el('span', { class: 'campaign__dot', 'aria-hidden': 'true' }),
        el('span', { class: 'campaign__name', text: name }),
        el('span', { class: 'campaign__count', text: String(countFor(id)) }));
      if (state.current === id) btn.setAttribute('aria-current', 'true');
      ui.campaignList.append(el('li', {}, btn));
    }
    item('all', '전체', 'all');
    state.campaigns.forEach(function (c) { item(c.id, c.name, c.color); });
  }
  ui.campaignList.addEventListener('click', function (e) {
    var btn = e.target.closest('.campaign');
    if (btn) selectCampaign(btn.getAttribute('data-id'));
  });

  function selectCampaign(id) {
    state.current = id;
    store('current', id);
    if (id !== 'all') selectComposerCampaign(id);
    render();
  }

  function renderTitle() {
    var c = state.current === 'all' ? null : campaignById(state.current);
    ui.pageTitle.setAttribute('data-c', c ? c.color : 'all');
    ui.titleText.textContent = c ? c.name : '전체 히스토리';
    ui.titleSub.textContent = '기록 ' + countFor(state.current) + '개';
    ui.titleActions.hidden = !c;
  }

  function renderComposerOptions() {
    var keep = ui.cSelect.value;
    ui.cSelect.replaceChildren();
    var has = state.campaigns.length > 0;
    if (!has) ui.cSelect.append(el('option', { value: '', text: '캠페인을 먼저 만들어 주세요' }));
    state.campaigns.forEach(function (c) {
      ui.cSelect.append(el('option', { value: c.id, text: c.name }));
    });
    if (has) ui.cSelect.value = campaignById(keep) ? keep : state.campaigns[0].id;
    [ui.cSelect, ui.cDate, ui.cText, ui.cSubmit].forEach(function (n) { n.disabled = !has; });
    syncComposerColor();
  }
  function selectComposerCampaign(id) {
    if (id && campaignById(id)) ui.cSelect.value = id;
    syncComposerColor();
  }
  function syncComposerColor() {
    ui.composer.setAttribute('data-c', colorOf(ui.cSelect.value));
  }
  ui.cSelect.addEventListener('change', syncComposerColor);

  // ---------- 검색 ----------
  function tokens() {
    return state.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  }
  // 날짜는 여러 표기로 검색되게: 2026-11-08 / 2026.11.08 / 2026/11/8 / 2026년 11월 8일 / 11월 8일
  function dateForms(iso) {
    var p = iso.split('-'), y = p[0], m = p[1], d = p[2], mn = +m, dn = +d;
    return [iso, y + '.' + m + '.' + d, y + '/' + mn + '/' + dn, y + '년 ' + mn + '월 ' + dn + '일', mn + '월 ' + dn + '일', mn + '/' + dn].join(' ');
  }
  function matches(h, toks) {
    if (state.current !== 'all' && h.campaign_id !== state.current) return false;
    if (!toks.length) return true;
    var c = campaignById(h.campaign_id);
    var hay = (h.content + ' ' + dateForms(h.event_date) + ' ' + (c ? c.name : '')).toLowerCase();
    return toks.every(function (t) { return hay.indexOf(t) !== -1; });   // 단어가 전부 들어 있어야 함
  }
  function highlight(text, toks) {
    var frag = document.createDocumentFragment();
    if (!toks.length) { frag.append(text); return frag; }
    var sorted = toks.slice().sort(function (a, b) { return b.length - a.length; });
    var re = new RegExp('(' + sorted.map(escapeRe).join('|') + ')', 'gi');
    text.split(re).forEach(function (part, i) {
      if (i % 2) frag.append(el('mark', { text: part }));
      else if (part) frag.append(part);
    });
    return frag;
  }

  function renderTimeline() {
    var toks = tokens();
    var list = state.histories.filter(function (h) { return matches(h, toks); });   // 이미 날짜 최신순
    ui.timeline.replaceChildren();
    ui.resultCount.textContent = (toks.length ? '검색 결과 ' : '') + list.length + '개';

    if (!list.length) {
      var msg = toks.length ? '“' + state.query.trim() + '” 검색 결과가 없어요.'
        : state.campaigns.length ? '아직 기록이 없어요. 위에서 첫 히스토리를 추가해 보세요.'
        : '먼저 왼쪽에서 “+ 새 캠페인”을 만들어 주세요.';
      ui.timeline.append(el('div', { class: 'empty', text: msg }));
      return;
    }

    var group = null, lastDate = null;
    list.forEach(function (h) {
      if (h.event_date !== lastDate) {
        lastDate = h.event_date;
        group = el('div', { class: 'day__list' });
        ui.timeline.append(el('section', { class: 'day' },
          el('h3', { class: 'day__head', text: fmtDate(h.event_date) }), group));
      }
      var c = campaignById(h.campaign_id);
      var body = el('div', { class: 'entry__body' });
      if (state.current === 'all' && c) body.append(el('span', { class: 'badge', text: c.name }));
      var text = el('p', { class: 'entry__text' });
      text.append(highlight(h.content, toks));
      body.append(text);
      var del = el('button', { type: 'button', class: 'entry__del', 'data-id': String(h.id), 'aria-label': '이 히스토리 삭제', text: '삭제' });
      group.append(el('article', { class: 'entry', 'data-c': colorOf(h.campaign_id) }, body, del));
    });
  }

  ui.q.addEventListener('input', function () {      // 한 글자 칠 때마다 바로 걸러짐
    state.query = ui.q.value;
    renderTimeline();
  });
  ui.q.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && ui.q.value) { ui.q.value = ''; state.query = ''; renderTimeline(); }
  });

  // ---------- 히스토리 추가 / 삭제 ----------
  ui.cText.addEventListener('input', function () {
    ui.cCount.textContent = ui.cText.value.length + ' / 1000';
  });
  ui.cText.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); ui.composer.requestSubmit(); }
  });

  ui.composer.addEventListener('submit', async function (e) {
    e.preventDefault();
    var content = ui.cText.value.trim();
    if (!content) { ui.cText.focus(); return; }
    ui.cSubmit.disabled = true;
    try {
      var res = await Api.addHistory({ campaign_id: ui.cSelect.value, content: content, event_date: ui.cDate.value });
      state.histories.push(res.item);
      sortHistories();
      ui.cText.value = '';
      ui.cCount.textContent = '0 / 1000';
      render();
      var shown = matches(res.item, tokens());
      toast(shown ? '추가했어요.' : '추가했어요. (현재 선택한 캠페인/검색어 때문에 목록에는 안 보여요)');
      ui.cText.focus();
    } catch (err) {
      handleError(err);
    } finally {
      ui.cSubmit.disabled = state.campaigns.length === 0;
    }
  });

  ui.timeline.addEventListener('click', async function (e) {
    var btn = e.target.closest('.entry__del');
    if (!btn) return;
    var id = Number(btn.getAttribute('data-id'));
    var h = state.histories.find(function (x) { return x.id === id; });
    if (!h) return;
    var preview = h.content.length > 40 ? h.content.slice(0, 40) + '…' : h.content;
    if (!confirm('이 히스토리를 삭제할까요?\n\n' + h.event_date + '  ' + preview + '\n\n되돌릴 수 없어요.')) return;
    btn.disabled = true;
    try {
      await Api.deleteHistory(id);
      state.histories = state.histories.filter(function (x) { return x.id !== id; });
      render();
      toast('삭제했어요.');
    } catch (err) {
      btn.disabled = false;
      handleError(err);
    }
  });

  // ---------- 캠페인 추가 / 수정 / 삭제 ----------
  var editingId = null;

  function buildSwatches(selected) {
    ui.cdColors.replaceChildren();
    COLORS.forEach(function (pair) {
      var input = el('input', { type: 'radio', name: 'cdColor', value: pair[0], 'aria-label': pair[1] });
      if (pair[0] === selected) input.checked = true;
      ui.cdColors.append(el('label', { class: 'swatch', 'data-c': pair[0], title: pair[1] }, input, el('span')));
    });
  }

  function openCampaignDialog(campaign) {
    editingId = campaign ? campaign.id : null;
    ui.cdTitle.textContent = campaign ? '캠페인 수정' : '새 캠페인';
    ui.cdName.value = campaign ? campaign.name : '';
    var used = state.campaigns.map(function (c) { return c.color; });
    var firstFree = COLORS.map(function (p) { return p[0]; }).find(function (k) { return used.indexOf(k) === -1; });
    buildSwatches(campaign ? campaign.color : firstFree || 'indigo');    // 새로 만들 땐 안 쓴 색을 먼저 추천
    ui.campaignDialog.showModal();
    ui.cdName.focus();
  }
  ui.newCampaignBtn.addEventListener('click', function () { openCampaignDialog(null); });
  ui.editCampaignBtn.addEventListener('click', function () {
    var c = campaignById(state.current);
    if (c) openCampaignDialog(c);
  });
  ui.cdCancel.addEventListener('click', function () { ui.campaignDialog.close(); });

  ui.campaignForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    var name = ui.cdName.value.trim();
    var checked = ui.cdColors.querySelector('input:checked');
    if (!name) { ui.cdName.focus(); return; }
    var body = { name: name, color: checked ? checked.value : 'indigo' };
    try {
      if (editingId) {
        var up = await Api.updateCampaign(editingId, body);
        state.campaigns = state.campaigns.map(function (c) { return c.id === editingId ? up.item : c; });
        ui.campaignDialog.close();
        render();
        toast('수정했어요.');
      } else {
        var created = await Api.addCampaign(body);
        state.campaigns.push(created.item);
        ui.campaignDialog.close();
        selectCampaign(created.item.id);
        toast('캠페인을 만들었어요.');
      }
    } catch (err) {
      handleError(err);
    }
  });

  ui.deleteCampaignBtn.addEventListener('click', async function () {
    var c = campaignById(state.current);
    if (!c) return;
    var n = countFor(c.id);
    if (!confirm('“' + c.name + '” 캠페인과 그 안의 히스토리 ' + n + '개가 모두 삭제돼요.\n\n이 작업은 되돌릴 수 없어요. 진행할까요?')) return;
    try {
      await Api.deleteCampaign(c.id);
      state.campaigns = state.campaigns.filter(function (x) { return x.id !== c.id; });
      state.histories = state.histories.filter(function (h) { return h.campaign_id !== c.id; });
      selectCampaign('all');
      toast('삭제했어요.');
    } catch (err) {
      handleError(err);
    }
  });

  // ---------- 시작 ----------
  // 데이터를 불러와 화면을 열고, 실패하면 원인 문구와 "다시 시도" 안내를 보여 줌
  async function boot() {
    ui.retryBtn.disabled = true;
    try {
      await loadAll();
      showApp();
    } catch (err) {
      ui.app.hidden = true;
      ui.loadErrorMsg.textContent = (err && err.message) || '알 수 없는 오류예요.';
      ui.loadError.hidden = false;
    } finally {
      ui.retryBtn.disabled = false;
    }
  }
  ui.retryBtn.addEventListener('click', boot);
  boot();
})();
