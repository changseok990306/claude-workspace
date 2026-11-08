// 서버(공유 저장소) 동기화
//  - 시작할 때 /api/health 로 서버를 쓸 수 있는지 확인:
//      서버 없음(파일로 열기·정적 호스팅) → "로컬 모드": 이 브라우저에만 저장
//      서버 있음·정상 → "서버 모드": 내 변경을 뒤에서 서버로 보내고, 다른 사람의 변경을 받아 옴
//      서버 있음·설정 오류 → "오류": 정확한 원인을 화면에 보여 주고 이 브라우저에만 저장
//  - 내 변경: store 가 "달라진 항목"을 계산해 넘겨 주면 큐에 쌓아 두었다가 묶어서 전송 (실패하면 점점 길게 쉬며 재시도, 새로고침해도 큐는 남음)
//  - 남의 변경: 20초마다·창으로 돌아올 때·인터넷이 다시 연결될 때 받아 와서 합침
(function () {
  'use strict';
  var A = window.Ads = window.Ads || {};
  var store = A.store, schema = A.schema;

  var QUEUE_KEY = 'ads-queue-v2';
  var POLL_MS = 20000;          // 남의 변경을 확인하는 간격
  var OVERLAP_MS = 10000;       // 동시에 저장된 변경을 놓치지 않으려고 조금 겹쳐서 요청
  var BATCH = 200;              // 한 번에 보내는 변경 수 (서버 한도와 같음)
  var HEALTH_TIMEOUT = 5000, FIRST_PULL_TIMEOUT = 8000, REQUEST_TIMEOUT = 15000;

  var st = { mode: 'local', state: 'local', message: '', reason: '' };    // state: local | syncing | synced | offline | error
  var pending = {};             // 아직 못 보낸 변경: "컬렉션|id" → { c, id, item }
  var inflight = {};            // 지금 보내는 중인 변경
  var cursor = null;            // 서버에서 마지막으로 받은 변경 시각
  var listeners = [];
  var flushing = false, pulling = false, retryTimer = null, retryMs = 0, started = false, ready = null, pollTimer = null;

  function keyOf(op) { return op.c + '|' + op.id; }
  function isPending(k) { return !!pending[k] || !!inflight[k]; }
  function pendingCount() { return Object.keys(pending).length + Object.keys(inflight).length; }
  function status() { return { mode: st.mode, state: st.state, message: st.message, reason: st.reason, pending: pendingCount() }; }
  function setStatus(state, message, reason) {
    st.state = state;
    if (message !== undefined) st.message = message;
    if (reason !== undefined) st.reason = reason;
    listeners.forEach(function (fn) { try { fn(status()); } catch (e) { /* 화면 쪽 오류가 동기화를 멈추게 하지 않음 */ } });
  }

  // ---------- 통신 ----------
  function request(path, opts) {
    opts = opts || {};
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, opts.timeout || REQUEST_TIMEOUT) : null;
    return fetch(path, {
      method: opts.method || 'GET', cache: 'no-store', signal: ctl ? ctl.signal : undefined,
      headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    }).then(function (r) {
      return r.json().then(function (j) { return { ok: r.ok, status: r.status, json: j }; }, function () { return { ok: r.ok, status: r.status, json: null }; });
    }).then(function (res) { clearTimeout(timer); return res; }, function (e) { clearTimeout(timer); throw e; });
  }

  // ---------- 못 보낸 변경 보관 (새로고침해도 남게) ----------
  function saveQueue() {
    try {
      var list = Object.keys(pending).map(function (k) { return pending[k]; }).concat(Object.keys(inflight).map(function (k) { return inflight[k]; }));
      if (list.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(list)); else localStorage.removeItem(QUEUE_KEY);
    } catch (e) { /* 저장 공간이 없어도 동기화 자체는 계속 */ }
  }
  function loadQueue() {
    try {
      var raw = localStorage.getItem(QUEUE_KEY);
      if (!raw) return;
      JSON.parse(raw).forEach(function (op) {
        if (op && schema.COLLECTIONS.indexOf(op.c) !== -1 && typeof op.id === 'string' && schema.ID_RE.test(op.id)) pending[keyOf(op)] = op;
      });
    } catch (e) { /* 깨진 큐는 무시 */ }
  }

  // ---------- 내 변경 보내기 ----------
  function enqueue(ops) {
    ops.forEach(function (op) { pending[keyOf(op)] = op; });       // 같은 항목은 마지막 변경만 남음
    saveQueue();
    if (st.state !== 'offline') setStatus('syncing');
    scheduleFlush(0);
  }
  function scheduleFlush(ms) {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(flush, ms);
  }
  function requeue(batch) {
    batch.forEach(function (op) { var k = keyOf(op); delete inflight[k]; if (!pending[k]) pending[k] = op; });   // 그 사이 더 새 변경이 생겼으면 새 것을 유지
  }
  function backoff(message) {
    retryMs = Math.min(60000, retryMs ? retryMs * 2 : 2000);
    setStatus('offline', message || '연결이 끊겼어요. 다시 시도하고 있어요.');
    scheduleFlush(retryMs);
  }
  function flush() {
    if (flushing) return Promise.resolve();
    clearTimeout(retryTimer);
    var keys = Object.keys(pending);
    if (!keys.length) { if (st.state === 'syncing') setStatus('synced', ''); return Promise.resolve(); }
    flushing = true;
    var batch = keys.slice(0, BATCH).map(function (k) { return pending[k]; });
    batch.forEach(function (op) { var k = keyOf(op); inflight[k] = op; delete pending[k]; });
    return request('/api/ops', { method: 'POST', body: { ops: batch } }).then(function (res) {
      if (res.ok && res.json && res.json.ok) {
        batch.forEach(function (op) { delete inflight[keyOf(op)]; });
        if (res.json.rejected && res.json.rejected.length && window.console) console.warn('[ads] 서버가 거절한 변경:', res.json.rejected);
        retryMs = 0;
        saveQueue();
        if (Object.keys(pending).length) scheduleFlush(0); else setStatus('synced', '');
      } else if (res.status === 429) {
        requeue(batch); saveQueue();
        retryMs = 15000; setStatus('offline', '요청이 많아 잠시 쉬고 있어요. 곧 다시 시도해요.'); scheduleFlush(retryMs);
      } else if (res.status >= 400 && res.status < 500) {
        batch.forEach(function (op) { delete inflight[keyOf(op)]; });             // 요청 자체가 잘못된 경우: 다시 보내도 소용없으니 버림
        saveQueue();
        if (window.console) console.warn('[ads] 서버가 변경을 받아들이지 않았어요:', res.status, res.json);
        setStatus('error', '일부 변경을 저장하지 못했어요. 새로고침하면 서버의 최신 내용으로 맞춰져요.');
        if (Object.keys(pending).length) scheduleFlush(0);
      } else {
        requeue(batch); saveQueue();
        backoff('서버가 응답하지 않아요. 다시 시도하고 있어요.');
      }
    }, function () {
      requeue(batch); saveQueue();
      backoff('연결이 끊겼어요. 다시 시도하고 있어요.');
    }).then(function () { flushing = false; });
  }

  // ---------- 남의 변경 받아 오기 ----------
  function pull(forceFull) {
    if (pulling) return Promise.resolve();
    pulling = true;
    var url = '/api/state';
    if (!forceFull && cursor) {
      var t = Date.parse(cursor);
      if (!isNaN(t)) url += '?since=' + encodeURIComponent(new Date(t - OVERLAP_MS).toISOString());
    }
    return request(url, { timeout: FIRST_PULL_TIMEOUT }).then(function (res) {
      if (!res.ok || !res.json || !res.json.ok) throw new Error('bad response');
      store.applyRemote(res.json.items, { full: res.json.full, isPending: isPending });
      if (res.json.cursor) cursor = res.json.cursor;
      if (st.state === 'offline' || st.state === 'syncing' || st.state === 'local') {
        if (!pendingCount()) { retryMs = 0; setStatus('synced', ''); }
      }
    }).catch(function () {
      if (st.state !== 'offline') setStatus('offline', '공유 저장소에 연결하지 못했어요. 다시 시도하고 있어요.');
    }).then(function () { pulling = false; });
  }

  // ---------- 시작 ----------
  function usedServerBefore() {
    try { return !!(localStorage.getItem('ads-cache-v2') || localStorage.getItem(QUEUE_KEY)); } catch (e) { return false; }
  }
  function detect() {
    if (location.protocol === 'file:') return Promise.resolve({ mode: 'local' });       // 파일로 열었으면 서버가 있을 수 없음
    return request('/api/health', { timeout: HEALTH_TIMEOUT }).then(function (res) {
      if (res.status === 404 || res.status === 405) return { mode: 'local' };              // 이 주소에는 서버 함수가 없음(정적 호스팅 등)
      if (!res.json || typeof res.json.ok !== 'boolean') return { mode: 'local' };         // 서버 함수가 아닌 응답
      if (res.json.ok) return { mode: 'server' };
      // 설정 문제(환경변수·테이블·키)는 오류 모드. 일시적 장애(DB 오류·연결 불가)는 서버 모드로 시작해서
      // 저장해 둔 사본을 보여 주고 계속 다시 시도함 (장애 순간에 열었다고 데이터가 사라진 것처럼 보이면 안 됨)
      if (res.json.reason === 'net' || res.json.reason === 'db') return { mode: 'server', message: res.json.message };
      return { mode: 'error', message: res.json.message || '공유 저장소를 쓸 수 없어요.', reason: res.json.reason || '' };
    }, function () {
      // 서버에 아예 닿지 않음: 예전에 서버 모드로 쓴 적이 있는 브라우저면 서버 모드로(사본·대기 중인 변경 보호), 처음이면 오류 모드
      if (usedServerBefore()) return { mode: 'server', message: '서버에 연결할 수 없어요. 다시 시도하고 있어요.' };
      return { mode: 'error', message: '서버에 연결할 수 없어요. 인터넷 연결을 확인해 주세요.', reason: 'net' };
    });
  }

  function startServer(degradedMessage) {
    store.enterServerMode();
    loadQueue();
    store.setSyncHook({ push: enqueue });
    setStatus(degradedMessage ? 'offline' : 'syncing', degradedMessage || '');
    var first = pull(true);
    var wait = new Promise(function (resolve) { setTimeout(resolve, FIRST_PULL_TIMEOUT + 1000); });   // 첫 응답이 늦어도 화면은 열어 줌(저장해 둔 사본으로)
    return Promise.race([first, wait]).then(function () {
      if (pendingCount() || Object.keys(pending).length) scheduleFlush(0);
      pollTimer = setInterval(function () { if (document.visibilityState !== 'hidden') pull(false); }, POLL_MS);
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { pull(false); flush(); } });
      window.addEventListener('focus', function () { pull(false); });
      window.addEventListener('online', function () { flush(); pull(false); });
      window.addEventListener('beforeunload', function (e) {      // 아직 못 보낸 변경이 있으면 창을 닫기 전에 한 번 더 물어봄
        if (pendingCount()) { e.preventDefault(); e.returnValue = ''; }
      });
    });
  }

  function start() {
    if (started) return ready;
    started = true;
    ready = detect().then(function (d) {
      st.mode = d.mode;
      if (d.mode === 'server') return startServer(d.message);
      if (d.mode === 'error') setStatus('error', d.message, d.reason);
      else setStatus('local', '');
    });
    return ready;
  }

  A.sync = {
    start: start,
    status: status,
    onStatus: function (fn) { listeners.push(fn); },
    pull: function () { return pull(false); },
    flush: flush,
    isAsync: function () { return location.protocol !== 'file:'; },     // 서버 확인을 기다려야 하는지(불러오는 중 화면용)
  };
})();
