// 데이터 저장소 — 지금은 이 브라우저(localStorage)에 저장.
// 화면은 이 파일의 함수만 부르므로, 나중에 DB(Supabase 등)로 바꿀 때 이 파일만 교체하면 됩니다.
(function () {
  'use strict';
  var A = window.Ads = window.Ads || {};
  var calc = A.calc;

  var KEY = 'ads-data-v1';
  var COLORS = [['indigo', '인디고'], ['teal', '청록'], ['amber', '호박'], ['rose', '장미'],
                ['green', '초록'], ['violet', '보라'], ['orange', '주황'], ['slate', '회색']];
  var TYPES = ['배너', '영상', '텍스트', '이메일', '기타'];
  var STATUSES = [['ready', '준비'], ['live', '집행 중'], ['done', '종료']];
  // 소재 변경 일정의 종류 [키, 이름, 달력에 붙는 기호]
  var SCHEDULE_TYPES = [['swap', '소재 교체', '↻'], ['open', '신규 오픈', '＋'], ['end', '종료', '■'], ['check', '점검', '✓']];
  // 체크리스트 업무 종류: daily 매일 / weekdays 평일(월~금) / once 한 번(마감일 있으면 기한 업무, 없으면 기한 없음)
  var TASK_KINDS = ['daily', 'weekdays', 'once'];
  var LIMITS = { campaigns: 100, histories: 5000, creatives: 1000, checklist: 30, schedules: 2000, tasks: 1000, doneDates: 1000 };
  var DEFAULT_CHECKLIST = ['규격·사이즈 확인', '문구 검수', '랜딩 링크 확인', 'UTM 파라미터 확인', '승인 완료'];

  var state = empty();
  var listeners = [];
  var storageOk = true;
  var loadWarning = '';
  var saveErrorHandler = null;

  function empty() { return { version: 1, campaigns: [], histories: [], creatives: [], schedules: [], tasks: [] }; }
  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }
  function str(v, max) { return typeof v === 'string' ? v.trim().slice(0, max) : ''; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function nn(v) { var n = typeof v === 'number' ? v : Number(v); return isFinite(n) && n >= 0 && n <= 1e13 ? n : null; }
  function colorOk(c) { return COLORS.some(function (p) { return p[0] === c; }); }
  function statusOk(s) { return STATUSES.some(function (p) { return p[0] === s; }); }
  function schedTypeOk(t) { return SCHEDULE_TYPES.some(function (p) { return p[0] === t; }); }
  function err(msg) { return { ok: false, error: msg }; }

  // ---------- 불러온 데이터를 안전한 모양으로 정리 (손상·조작된 값 제거) ----------
  function sanitize(raw) {
    var out = empty();
    if (!raw || typeof raw !== 'object') return out;
    var ids = {};

    arr(raw.campaigns).slice(0, LIMITS.campaigns).forEach(function (c) {
      var name = str(c && c.name, 40);
      var id = str(c && c.id, 64) || uid();
      if (!name || ids[id]) return;
      ids[id] = true;
      out.campaigns.push({ id: id, name: name, color: colorOk(c.color) ? c.color : 'slate' });
    });

    arr(raw.histories).slice(0, LIMITS.histories).forEach(function (h) {
      if (!h || !ids[h.campaignId] || !calc.validDate(h.date)) return;
      var content = str(h.content, 1000);
      if (!content) return;
      out.histories.push({ id: str(h.id, 64) || uid(), campaignId: h.campaignId, date: h.date, content: content,
        createdAt: nn(h.createdAt) || Date.now() });
    });

    arr(raw.creatives).slice(0, LIMITS.creatives).forEach(function (c) {
      if (!c || !ids[c.campaignId]) return;
      var title = str(c.title, 80);
      if (!title) return;
      var list = [];
      arr(c.checklist).slice(0, LIMITS.checklist).forEach(function (x) {
        var text = str(x && x.text, 100);
        if (text) list.push({ id: str(x.id, 64) || uid(), text: text, done: x.done === true });
      });
      out.creatives.push({ id: str(c.id, 64) || uid(), campaignId: c.campaignId, title: title,
        type: TYPES.indexOf(c.type) !== -1 ? c.type : '기타', status: statusOk(c.status) ? c.status : 'ready',
        memo: str(c.memo, 300), checklist: list, createdAt: nn(c.createdAt) || Date.now() });
    });
    arr(raw.schedules).slice(0, LIMITS.schedules).forEach(function (x) {
      if (!x || !ids[x.campaignId] || !calc.validDate(x.date)) return;
      var title = str(x.title, 80);
      if (!title) return;
      out.schedules.push({ id: str(x.id, 64) || uid(), campaignId: x.campaignId, date: x.date,
        type: schedTypeOk(x.type) ? x.type : 'swap', title: title, memo: str(x.memo, 300),
        done: x.done === true, createdAt: nn(x.createdAt) || Date.now() });
    });
    arr(raw.tasks).slice(0, LIMITS.tasks).forEach(function (x) {
      if (!x) return;
      var title = str(x.title, 80);
      var cid = typeof x.campaignId === 'string' ? x.campaignId : '';
      if (!title || TASK_KINDS.indexOf(x.kind) === -1 || (cid && !ids[cid])) return;   // 없는 캠페인에 달린 업무는 버림("" = 공통 업무)
      var kind = x.kind, start = calc.validDate(x.start) ? x.start : '', due = calc.validDate(x.due) ? x.due : '';
      if (kind !== 'once' && !start) start = calc.today();
      if (start && due && due < start) due = '';
      if (kind === 'once' && !due) start = '';
      var seen = {}, dates = [];
      arr(x.doneDates).forEach(function (d) { if (calc.validDate(d) && !seen[d]) { seen[d] = true; dates.push(d); } });
      dates.sort();
      var isDone = x.done === true;
      out.tasks.push({ id: str(x.id, 64) || uid(), campaignId: cid, title: title, memo: str(x.memo, 300), kind: kind,
        start: start, due: due, doneDates: dates.slice(-LIMITS.doneDates), done: isDone,
        doneAt: isDone && calc.validDate(x.doneAt) ? x.doneAt : '', createdAt: nn(x.createdAt) || Date.now() });
    });
    return out;
  }

  // ---------- 저장 / 불러오기 ----------
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    catch (e) { storageOk = false; if (saveErrorHandler) saveErrorHandler(e); return false; }
  }
  function commit() { var saved = persist(); listeners.forEach(function (fn) { fn(); }); return saved; }
  function load() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { storageOk = false; }
    if (!raw) { state = empty(); return; }
    try {
      var parsed = JSON.parse(raw);
      // 지금 버전에는 "성과·예산" 기능이 없음. 예전에 입력한 데이터가 있으면 지워지기 전에 따로 한 번 보관해 둠
      if (arr(parsed.performance).length || arr(parsed.budgets).length) {
        try {
          if (!localStorage.getItem(KEY + '-removed')) {
            localStorage.setItem(KEY + '-removed', JSON.stringify({ performance: arr(parsed.performance), budgets: arr(parsed.budgets), savedAt: new Date().toISOString() }));
          }
        } catch (e2) {}
      }
      state = sanitize(parsed);
    } catch (e) {
      try { localStorage.setItem(KEY + '-corrupt', raw); } catch (e3) {}
      state = empty();
      loadWarning = '저장된 데이터를 읽지 못해 새로 시작했어요. (원본은 브라우저에 보관해 두었어요)';
    }
  }

  // ---------- 캠페인 ----------
  function validateCampaign(i) {
    var name = str(i && i.name, 41);
    if (!name || name.length > 40) return err('캠페인 이름은 1~40자로 적어 주세요.');
    var color = i.color === undefined ? 'indigo' : i.color;
    if (!colorOk(color)) return err('색상 값이 올바르지 않아요.');
    return { ok: true, name: name, color: color };
  }
  function nextColor() {
    var used = state.campaigns.map(function (c) { return c.color; });
    var free = COLORS.filter(function (p) { return used.indexOf(p[0]) === -1; });
    return (free.length ? free[0] : COLORS[state.campaigns.length % COLORS.length])[0];
  }
  function addCampaign(i) {
    var v = validateCampaign(i);
    if (!v.ok) return v;
    if (state.campaigns.length >= LIMITS.campaigns) return err('캠페인은 ' + LIMITS.campaigns + '개까지 만들 수 있어요.');
    var c = { id: uid(), name: v.name, color: v.color };
    state.campaigns.push(c);
    return { ok: true, item: c, saved: commit() };
  }
  function updateCampaign(id, i) {
    var c = campaignById(id);
    if (!c) return err('없는 캠페인이에요.');
    var v = validateCampaign(i);
    if (!v.ok) return v;
    c.name = v.name; c.color = v.color;
    return { ok: true, item: c, saved: commit() };
  }
  function deleteCampaign(id) {   // 소속된 히스토리·소재·일정·업무도 함께 삭제 (공통 업무는 남음)
    if (!campaignById(id)) return err('없는 캠페인이에요.');
    ['campaigns', 'histories', 'creatives', 'schedules', 'tasks'].forEach(function (k) {
      state[k] = state[k].filter(function (x) { return (k === 'campaigns' ? x.id : x.campaignId) !== id; });
    });
    return { ok: true, saved: commit() };
  }
  function campaignById(id) { return state.campaigns.find(function (c) { return c.id === id; }); }

  // CSV 가져오기용: 이름으로 캠페인 찾기 (없으면 자동 생성 옵션)
  function idByName(name, autoCreate, created) {
    var key = String(name).trim().toLowerCase();
    var f = state.campaigns.find(function (c) { return c.name.toLowerCase() === key; });
    if (f) return f.id;
    if (!autoCreate || state.campaigns.length >= LIMITS.campaigns) return null;
    var c = { id: uid(), name: String(name).trim(), color: nextColor() };
    state.campaigns.push(c);
    created.push(c.name);
    return c.id;
  }

  // ---------- 히스토리 ----------
  function addHistory(i) {
    if (!i || !campaignById(i.campaignId)) return err('캠페인을 선택해 주세요.');
    if (!calc.validDate(i.date)) return err('날짜를 올바르게 입력해 주세요.');
    var content = str(i.content, 1001);
    if (!content || content.length > 1000) return err('내용은 1~1000자로 적어 주세요.');
    if (state.histories.length >= LIMITS.histories) return err('히스토리는 ' + LIMITS.histories + '개까지 저장할 수 있어요.');
    var h = { id: uid(), campaignId: i.campaignId, date: i.date, content: content, createdAt: Date.now() };
    state.histories.push(h);
    return { ok: true, item: h, saved: commit() };
  }
  function deleteHistory(id) {
    var n = state.histories.length;
    state.histories = state.histories.filter(function (h) { return h.id !== id; });
    return n === state.histories.length ? err('없는 히스토리예요.') : { ok: true, saved: commit() };
  }
  function addHistories(items, opts) {
    var created = [], added = 0, skipped = 0;
    items.forEach(function (it) {
      var cid = idByName(it.campaignName, opts && opts.autoCreate, created);
      if (!cid || state.histories.length >= LIMITS.histories) { skipped++; return; }
      state.histories.push({ id: uid(), campaignId: cid, date: it.date, content: it.content, createdAt: Date.now() });
      added++;
    });
    return { ok: true, added: added, skipped: skipped, created: created, saved: commit() };
  }

  // ---------- 소재일정 · 체크리스트 ----------
  function creativeById(id) { return state.creatives.find(function (c) { return c.id === id; }); }
  function addCreative(i) {
    if (!i || !campaignById(i.campaignId)) return err('캠페인을 선택해 주세요.');
    var title = str(i.title, 81);
    if (!title || title.length > 80) return err('소재 이름은 1~80자로 적어 주세요.');
    var type = TYPES.indexOf(i.type) !== -1 ? i.type : '기타';
    var status = statusOk(i.status) ? i.status : 'ready';
    if (state.creatives.length >= LIMITS.creatives) return err('소재는 ' + LIMITS.creatives + '개까지 저장할 수 있어요.');
    var list = i.withChecklist ? DEFAULT_CHECKLIST.map(function (t) { return { id: uid(), text: t, done: false }; }) : [];
    var c = { id: uid(), campaignId: i.campaignId, title: title, type: type, status: status,
      memo: str(i.memo, 300), checklist: list, createdAt: Date.now() };
    state.creatives.push(c);
    return { ok: true, item: c, saved: commit() };
  }
  function updateCreative(id, patch) {
    var c = creativeById(id);
    if (!c) return err('없는 소재예요.');
    if (patch.status !== undefined) { if (!statusOk(patch.status)) return err('상태 값이 올바르지 않아요.'); c.status = patch.status; }
    if (patch.memo !== undefined) c.memo = str(patch.memo, 300);
    return { ok: true, item: c, saved: commit() };
  }
  function deleteCreative(id) {
    var n = state.creatives.length;
    state.creatives = state.creatives.filter(function (c) { return c.id !== id; });
    return n === state.creatives.length ? err('없는 소재예요.') : { ok: true, saved: commit() };
  }
  function addCheck(id, text) {
    var c = creativeById(id);
    if (!c) return err('없는 소재예요.');
    var t = str(text, 101);
    if (!t || t.length > 100) return err('체크 항목은 1~100자로 적어 주세요.');
    if (c.checklist.length >= LIMITS.checklist) return err('체크 항목은 ' + LIMITS.checklist + '개까지예요.');
    c.checklist.push({ id: uid(), text: t, done: false });
    return { ok: true, saved: commit() };
  }
  function toggleCheck(id, checkId) {
    var c = creativeById(id), x = c && c.checklist.find(function (k) { return k.id === checkId; });
    if (!x) return err('없는 항목이에요.');
    x.done = !x.done;
    return { ok: true, saved: commit() };
  }
  function removeCheck(id, checkId) {
    var c = creativeById(id);
    if (!c) return err('없는 소재예요.');
    c.checklist = c.checklist.filter(function (k) { return k.id !== checkId; });
    return { ok: true, saved: commit() };
  }

  // ---------- 소재 변경 일정 (캘린더) ----------
  function scheduleById(id) { return state.schedules.find(function (x) { return x.id === id; }); }
  function addSchedule(i) {
    if (!i || !campaignById(i.campaignId)) return err('캠페인을 선택해 주세요.');
    if (!calc.validDate(i.date)) return err('날짜를 올바르게 입력해 주세요.');
    var title = str(i.title, 81);
    if (!title || title.length > 80) return err('일정 내용은 1~80자로 적어 주세요.');
    var type = i.type === undefined ? 'swap' : i.type;
    if (!schedTypeOk(type)) return err('일정 종류가 올바르지 않아요.');
    if (state.schedules.length >= LIMITS.schedules) return err('일정은 ' + LIMITS.schedules + '개까지 저장할 수 있어요.');
    var x = { id: uid(), campaignId: i.campaignId, date: i.date, type: type, title: title,
      memo: str(i.memo, 300), done: false, createdAt: Date.now() };
    state.schedules.push(x);
    return { ok: true, item: x, saved: commit() };
  }
  function toggleSchedule(id) {      // 확인 완료 ↔ 미완료
    var x = scheduleById(id);
    if (!x) return err('없는 일정이에요.');
    x.done = !x.done;
    return { ok: true, item: x, saved: commit() };
  }
  function deleteSchedule(id) {
    var n = state.schedules.length;
    state.schedules = state.schedules.filter(function (x) { return x.id !== id; });
    return n === state.schedules.length ? err('없는 일정이에요.') : { ok: true, saved: commit() };
  }

  // ---------- 체크리스트 (업무) ----------
  function taskById(id) { return state.tasks.find(function (x) { return x.id === id; }); }
  // 입력값 검사 → 저장할 값. 반복 업무는 시작일 필수(종료일 선택), 기한 업무는 마감일(+선택 시작일), 기한 없음은 날짜 없음
  function cleanTask(i) {
    var title = str(i && i.title, 81);
    if (!title || title.length > 80) return err('업무 이름은 1~80자로 적어 주세요.');
    if (TASK_KINDS.indexOf(i.kind) === -1) return err('업무 종류가 올바르지 않아요.');
    var cid = i.campaignId ? String(i.campaignId) : '';
    if (cid && !campaignById(cid)) return err('없는 캠페인이에요.');
    var start = i.start ? String(i.start) : '', due = i.due ? String(i.due) : '';
    if (start && !calc.validDate(start)) return err('시작일을 올바르게 입력해 주세요.');
    if (due && !calc.validDate(due)) return err((i.kind === 'once' ? '마감일' : '종료일') + '을 올바르게 입력해 주세요.');
    if (i.kind !== 'once' && !start) return err('시작일을 입력해 주세요.');
    if (i.kind === 'once' && !due) start = '';                 // 기한 없음 업무에는 날짜가 없음 (마감일 없이 시작일만 있으면 시작일은 버림)
    if (start && due && due < start) return err((i.kind === 'once' ? '마감일' : '종료일') + '이 시작일보다 앞이에요.');
    return { ok: true, value: { campaignId: cid, title: title, memo: str(i.memo, 300), kind: i.kind, start: start, due: due } };
  }
  function addTask(i) {
    var v = cleanTask(i);
    if (!v.ok) return v;
    if (state.tasks.length >= LIMITS.tasks) return err('업무는 ' + LIMITS.tasks + '개까지 저장할 수 있어요.');
    var x = Object.assign({ id: uid(), doneDates: [], done: false, doneAt: '', createdAt: Date.now() }, v.value);
    state.tasks.push(x);
    return { ok: true, item: x, saved: commit() };
  }
  function updateTask(id, i) {      // 체크 기록(doneDates/done)은 그대로 두고 내용만 바꿈
    var x = taskById(id);
    if (!x) return err('없는 업무예요.');
    var v = cleanTask(i);
    if (!v.ok) return v;
    Object.assign(x, v.value);
    return { ok: true, item: x, saved: commit() };
  }
  // 반복 업무: day(날짜)의 체크를 켜고 끔 / 한 번짜리 업무: 완료 <-> 미완료 (완료한 날짜 = day)
  function toggleTask(id, day) {
    var x = taskById(id);
    if (!x) return err('없는 업무예요.');
    if (!calc.validDate(day)) return err('날짜가 올바르지 않아요.');
    if (x.kind === 'once') { x.done = !x.done; x.doneAt = x.done ? day : ''; }
    else {
      var at = x.doneDates.indexOf(day);
      if (at === -1) { x.doneDates.push(day); x.doneDates.sort(); if (x.doneDates.length > LIMITS.doneDates) x.doneDates = x.doneDates.slice(-LIMITS.doneDates); }
      else x.doneDates.splice(at, 1);
    }
    return { ok: true, item: x, saved: commit() };
  }
  function deleteTask(id) {
    var n = state.tasks.length;
    state.tasks = state.tasks.filter(function (x) { return x.id !== id; });
    return n === state.tasks.length ? err('없는 업무예요.') : { ok: true, saved: commit() };
  }

  // ---------- 백업 · 복원 · 초기화 ----------
  function counts(d) {
    d = d || state;
    return { campaigns: d.campaigns.length, histories: d.histories.length, creatives: d.creatives.length, schedules: d.schedules.length, tasks: d.tasks.length };
  }
  function exportJSON() {
    return JSON.stringify({ app: 'ads-operations', exportedAt: new Date().toISOString(), data: state }, null, 2);
  }
  // 파일 내용을 검사만 함(아직 바꾸지 않음) → 화면에서 개수를 보여 주고 확인받은 뒤 replaceAll
  function previewBackup(text) {
    var parsed;
    try { parsed = JSON.parse(text); } catch (e) { return err('JSON 파일이 아니에요. 이 사이트에서 내보낸 백업 파일을 선택해 주세요.'); }
    var raw = parsed && parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.campaigns)) return err('백업 파일 형식이 아니에요.');
    var clean = sanitize(raw);
    return { ok: true, data: clean, counts: counts(clean), dropped: raw.campaigns.length - clean.campaigns.length,
      hasRemoved: arr(raw.performance).length > 0 || arr(raw.budgets).length > 0 };   // 예전 버전의 성과·예산이 들어 있었는지
  }
  function replaceAll(data) { state = sanitize(data); return { ok: true, saved: commit() }; }
  function clearAll() { state = empty(); return { ok: true, saved: commit() }; }

  // 예시 데이터(sample.js)를 지금 데이터에 추가
  function addSample(data) {
    var names = state.campaigns.map(function (c) { return c.name; });
    if (data.campaigns.some(function (c) { return names.indexOf(c.name) !== -1; })) return err('예시 데이터가 이미 들어 있어요.');
    var clean = sanitize(data);
    if (state.campaigns.length + clean.campaigns.length > LIMITS.campaigns) return err('캠페인 수가 너무 많아요.');
    Object.keys(clean).forEach(function (k) { if (Array.isArray(clean[k])) state[k] = state[k].concat(clean[k]); });
    return { ok: true, counts: counts(clean), saved: commit() };
  }

  load();

  A.store = {
    COLORS: COLORS, TYPES: TYPES, STATUSES: STATUSES, SCHEDULE_TYPES: SCHEDULE_TYPES, TASK_KINDS: TASK_KINDS, LIMITS: LIMITS, KEY: KEY,
    get: function () { return state; },
    subscribe: function (fn) { listeners.push(fn); },
    status: function () { return { storageOk: storageOk, loadWarning: loadWarning }; },
    onSaveError: function (fn) { saveErrorHandler = fn; },
    campaignById: campaignById, creativeById: creativeById, scheduleById: scheduleById, taskById: taskById, nextColor: nextColor,
    addCampaign: addCampaign, updateCampaign: updateCampaign, deleteCampaign: deleteCampaign,
    addHistory: addHistory, addHistories: addHistories, deleteHistory: deleteHistory,
    addCreative: addCreative, updateCreative: updateCreative, deleteCreative: deleteCreative,
    addCheck: addCheck, toggleCheck: toggleCheck, removeCheck: removeCheck,
    addSchedule: addSchedule, toggleSchedule: toggleSchedule, deleteSchedule: deleteSchedule,
    addTask: addTask, updateTask: updateTask, toggleTask: toggleTask, deleteTask: deleteTask,
    exportJSON: exportJSON, previewBackup: previewBackup, replaceAll: replaceAll, clearAll: clearAll,
    addSample: addSample, counts: function () { return counts(state); },
    _sanitize: sanitize,
  };
})();
