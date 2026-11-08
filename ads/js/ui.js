// 화면 공통 도우미 — 사용자가 입력한 글은 전부 textContent 로만 출력합니다 (HTML 로 해석되지 않음).
(function () {
  'use strict';
  var A = window.Ads = window.Ads || {};
  A.views = A.views || {};

  var WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

  // el('div', {class:'x', text:'안녕', 'data-id':1, on:{click:fn}}, 자식1, 자식2 ...)
  function el(tag, props) {
    var n = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === 'text') n.textContent = v;
      else if (k === 'class') n.className = v;
      else if (k === 'on') Object.keys(v).forEach(function (ev) { n.addEventListener(ev, v[ev]); });
      else if (k === 'value') n.value = v;
      else n.setAttribute(k, v === true ? '' : v);
    });
    (function add(list) {
      list.forEach(function (c) {
        if (c == null || c === false) return;
        if (Array.isArray(c)) add(c); else n.append(c);
      });
    })(Array.prototype.slice.call(arguments, 2));
    return n;
  }

  // ---------- 숫자·날짜 표시 ----------
  function fmtNum(n) { return n == null || !isFinite(n) ? '-' : Math.round(n).toLocaleString('ko-KR'); }
  function fmtMoney(n) { return n == null || !isFinite(n) ? '-' : Math.round(n).toLocaleString('ko-KR') + '원'; }
  function fmtPct(n, d) { return n == null || !isFinite(n) ? '-' : n.toFixed(d == null ? 2 : d) + '%'; }
  function fmtCompact(n) {     // 차트 눈금용: 1.2억 / 3.4만 / 1,200
    if (n == null || !isFinite(n)) return '-';
    var a = Math.abs(n);
    if (a >= 1e8) return trim(n / 1e8) + '억';
    if (a >= 1e4) return trim(n / 1e4) + '만';
    return Math.round(n * 100) / 100 === Math.round(n) ? Math.round(n).toLocaleString('ko-KR') : String(Math.round(n * 100) / 100);
  }
  function trim(x) { return String(Math.round(x * 10) / 10).replace(/\.0$/, ''); }
  function fmtDate(iso) {
    var p = iso.split('-').map(Number);
    return p[0] + '년 ' + p[1] + '월 ' + p[2] + '일 (' + WEEKDAYS[new Date(p[0], p[1] - 1, p[2]).getDay()] + ')';
  }
  function fmtMd(iso) { return iso.slice(5); }

  // ---------- 알림 ----------
  var toastTimer;
  function toast(msg, isError) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast' + (isError ? ' toast--error' : '');
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 3400);
  }
  // 저장 결과를 공통 처리: 실패면 빨간 알림, 저장 공간 문제면 안내
  function report(res, okMessage) {
    if (!res.ok) { toast(res.error || '문제가 생겼어요.', true); return false; }
    if (res.saved === false) toast('저장 공간에 쓰지 못했어요. 데이터 메뉴에서 백업을 받아 두세요.', true);
    else if (okMessage) toast(okMessage);
    return true;
  }

  // ---------- 검색어 하이라이트 ----------
  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function highlight(text, tokens) {
    var frag = document.createDocumentFragment();
    if (!tokens.length) { frag.append(text); return frag; }
    var sorted = tokens.slice().sort(function (a, b) { return b.length - a.length; });
    var re = new RegExp('(' + sorted.map(escapeRe).join('|') + ')', 'gi');
    text.split(re).forEach(function (part, i) {
      if (i % 2) frag.append(el('mark', { text: part }));
      else if (part) frag.append(part);
    });
    return frag;
  }

  // ---------- 파일 ----------
  function download(filename, text, mime, withBom) {
    var blob = new Blob([(withBom ? '﻿' : '') + text], { type: mime || 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  function readText(file, maxBytes) {
    return new Promise(function (resolve, reject) {
      if (file.size > maxBytes) { reject(new Error('파일이 너무 커요. (최대 ' + Math.round(maxBytes / 1024 / 1024) + 'MB)')); return; }
      var fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result)); };
      fr.onerror = function () { reject(new Error('파일을 읽지 못했어요.')); };
      fr.readAsText(file, 'utf-8');
    });
  }
  function stamp() { return A.calc.today().replace(/-/g, ''); }

  A.ui = {
    el: el, fmtNum: fmtNum, fmtMoney: fmtMoney, fmtPct: fmtPct, fmtCompact: fmtCompact, fmtDate: fmtDate, fmtMd: fmtMd,
    toast: toast, report: report, highlight: highlight, download: download, readText: readText, stamp: stamp,
    badge: function (c) { return el('span', { class: 'badge', 'data-c': c.color, text: c.name }); },
  };
})();
