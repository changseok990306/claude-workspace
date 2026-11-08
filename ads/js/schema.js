// 데이터 모양과 검증 규칙 — 브라우저(store.js)와 서버(api/*.js)가 똑같이 씁니다.
// 외부에서 들어온 값(저장된 데이터, 다른 사람이 보낸 데이터)을 안전한 모양으로 정리하고, 이상한 것은 버려요.
(function (root, factory) {
  var api = factory(typeof module === 'object' && module.exports ? require('./calc.js') : root.Ads.calc);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.Ads = root.Ads || {}; root.Ads.schema = api; }
})(typeof self !== 'undefined' ? self : this, function (calc) {
  'use strict';

  var COLLECTIONS = ['campaigns', 'histories', 'creatives', 'schedules', 'tasks'];
  var COLORS = [['indigo', '인디고'], ['teal', '청록'], ['amber', '호박'], ['rose', '장미'],
                ['green', '초록'], ['violet', '보라'], ['orange', '주황'], ['slate', '회색']];
  var TYPES = ['배너', '영상', '텍스트', '이메일', '기타'];
  var STATUSES = [['ready', '준비'], ['live', '집행 중'], ['done', '종료']];
  // 소재 변경 일정의 종류 [키, 이름, 달력에 붙는 기호]
  var SCHEDULE_TYPES = [['swap', '소재 교체', '↻'], ['open', '신규 오픈', '＋'], ['end', '종료', '■'], ['check', '점검', '✓']];
  // 체크리스트 업무 종류: daily 매일 / weekdays 평일(월~금) / once 한 번(마감일 있으면 기한 업무, 없으면 기한 없음)
  var TASK_KINDS = ['daily', 'weekdays', 'once'];
  var LIMITS = { campaigns: 100, histories: 5000, creatives: 1000, checklist: 30, schedules: 2000, tasks: 1000, doneDates: 1000 };
  var ID_RE = /^[A-Za-z0-9_-]{1,64}$/;      // 항목 id 로 허용하는 글자 (DB 조회 조건에 그대로 쓰이므로 엄격하게)

  function str(v, max) { return typeof v === 'string' ? v.trim().slice(0, max) : ''; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function nn(v) { var n = typeof v === 'number' ? v : Number(v); return isFinite(n) && n >= 0 && n <= 1e13 ? n : null; }
  function colorOk(c) { return COLORS.some(function (p) { return p[0] === c; }); }
  function statusOk(s) { return STATUSES.some(function (p) { return p[0] === s; }); }
  function schedTypeOk(t) { return SCHEDULE_TYPES.some(function (p) { return p[0] === t; }); }

  // 항목 하나를 정리해서 돌려줌. 쓸 수 없는 항목이면 null.
  //   o.ids   : 있는 캠페인 id 목록 {id:true} — 있으면 그 캠페인에 달린 항목만 허용 (없으면 id 모양만 검사: 서버용)
  //   o.newId : id 가 없거나 이상할 때 새로 만드는 함수 (없으면 그 항목을 버림)
  function cleanItem(collection, x, o) {
    o = o || {};
    if (!x || typeof x !== 'object') return null;
    var rawId = typeof x.id === 'string' ? x.id.trim() : '';
    var id = ID_RE.test(rawId) ? rawId : (o.newId ? o.newId() : null);
    if (!id) return null;
    var now = Date.now();
    function fk(cid) { return typeof cid === 'string' && (o.ids ? !!o.ids[cid] : ID_RE.test(cid)); }

    if (collection === 'campaigns') {
      var name = str(x.name, 40);
      if (!name) return null;
      return { id: id, name: name, color: colorOk(x.color) ? x.color : 'slate' };
    }
    if (collection === 'histories') {
      if (!fk(x.campaignId) || !calc.validDate(x.date)) return null;
      var content = str(x.content, 1000);
      if (!content) return null;
      return { id: id, campaignId: x.campaignId, date: x.date, content: content, createdAt: nn(x.createdAt) || now };
    }
    if (collection === 'creatives') {
      if (!fk(x.campaignId)) return null;
      var title = str(x.title, 80);
      if (!title) return null;
      var list = [];
      arr(x.checklist).slice(0, LIMITS.checklist).forEach(function (k, i) {
        var text = str(k && k.text, 100);
        if (!text) return;
        var kid = k && typeof k.id === 'string' && ID_RE.test(k.id.trim()) ? k.id.trim() : (o.newId ? o.newId() : 'k' + i);
        list.push({ id: kid, text: text, done: k.done === true });
      });
      return { id: id, campaignId: x.campaignId, title: title,
        type: TYPES.indexOf(x.type) !== -1 ? x.type : '기타', status: statusOk(x.status) ? x.status : 'ready',
        memo: str(x.memo, 300), checklist: list, createdAt: nn(x.createdAt) || now };
    }
    if (collection === 'schedules') {
      if (!fk(x.campaignId) || !calc.validDate(x.date)) return null;
      var stitle = str(x.title, 80);
      if (!stitle) return null;
      return { id: id, campaignId: x.campaignId, date: x.date, type: schedTypeOk(x.type) ? x.type : 'swap',
        title: stitle, memo: str(x.memo, 300), done: x.done === true, createdAt: nn(x.createdAt) || now };
    }
    if (collection === 'tasks') {
      var ttl = str(x.title, 80);
      var cid = typeof x.campaignId === 'string' ? x.campaignId : '';
      if (!ttl || TASK_KINDS.indexOf(x.kind) === -1 || (cid && !fk(cid))) return null;   // "" = 공통 업무
      var kind = x.kind, start = calc.validDate(x.start) ? x.start : '', due = calc.validDate(x.due) ? x.due : '';
      if (kind !== 'once' && !start) start = calc.today();
      if (start && due && due < start) due = '';
      if (kind === 'once' && !due) start = '';
      var seen = {}, dates = [];
      arr(x.doneDates).forEach(function (d) { if (calc.validDate(d) && !seen[d]) { seen[d] = true; dates.push(d); } });
      dates.sort();
      var isDone = x.done === true;
      return { id: id, campaignId: cid, title: ttl, memo: str(x.memo, 300), kind: kind, start: start, due: due,
        doneDates: dates.slice(-LIMITS.doneDates), done: isDone,
        doneAt: isDone && calc.validDate(x.doneAt) ? x.doneAt : '', createdAt: nn(x.createdAt) || now };
    }
    return null;
  }

  return {
    COLLECTIONS: COLLECTIONS, COLORS: COLORS, TYPES: TYPES, STATUSES: STATUSES, SCHEDULE_TYPES: SCHEDULE_TYPES,
    TASK_KINDS: TASK_KINDS, LIMITS: LIMITS, ID_RE: ID_RE,
    cleanItem: cleanItem, str: str, arr: arr, nn: nn,
  };
});
