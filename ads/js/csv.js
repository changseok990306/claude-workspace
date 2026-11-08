// CSV 읽기/쓰기 + 가져오기 규칙 (브라우저와 Node 양쪽에서 동작)
(function (root, factory) {
  var api = factory(typeof module === 'object' && module.exports ? require('./calc.js') : root.Ads.calc);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.Ads = root.Ads || {}; root.Ads.csv = api; }
})(typeof self !== 'undefined' ? self : this, function (calc) {
  'use strict';

  var MAX_ROWS = 5000;

  // ---------- 읽기 ----------
  function detectDelimiter(line) {
    var count = { ',': 0, ';': 0, '\t': 0 }, inQ = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (ch === '"') inQ = !inQ;
      else if (!inQ && count[ch] !== undefined) count[ch]++;
    }
    return count[';'] > count[','] && count[';'] >= count['\t'] ? ';' : count['\t'] > count[','] ? '\t' : ',';
  }

  // 따옴표("…"), 줄바꿈이 든 칸, 엑셀의 BOM, 쉼표·세미콜론·탭 구분을 처리
  function parse(text) {
    text = String(text || '');
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    var delim = detectDelimiter(text.split(/\r?\n/, 1)[0]);
    var rows = [], row = [], field = '', inQ = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (inQ) {
        if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
        else field += ch;
      } else if (ch === '"') {
        inQ = true;
      } else if (ch === delim) {
        row.push(field); field = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (!(row.length === 1 && row[0] === '')) rows.push(row);   // 완전히 빈 줄은 건너뜀
        row = [];
      } else {
        field += ch;
      }
    }
    if (field !== '' || row.length) { row.push(field); if (!(row.length === 1 && row[0] === '')) rows.push(row); }
    return rows;
  }

  // ---------- 쓰기 ----------
  // 엑셀에서 열 때 수식으로 실행되는 것을 막기 위해, 문자열이 = + - @ 로 시작하면 앞에 ' 를 붙임
  function cell(v) {
    if (v == null) return '';
    var s = typeof v === 'number' ? String(v) : String(v);
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCSV(rows) {
    return rows.map(function (r) { return r.map(cell).join(','); }).join('\r\n');
  }

  // ---------- 가져오기 규칙 ----------
  function normHeader(h) {
    return String(h == null ? '' : h).replace(/^﻿/, '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[\s_\-]/g, '');
  }
  var SCHEMAS = {
    performance: {
      label: '성과',
      cols: [
        { key: 'date', name: '날짜', aliases: ['date', '날짜', '일자', '일별', '기간'], required: true },
        { key: 'campaign', name: '캠페인', aliases: ['campaign', 'campaignname', '캠페인', '캠페인명', '캠페인이름'], required: true },
        { key: 'impressions', name: '노출', aliases: ['impressions', 'impression', 'impr', '노출', '노출수'] },
        { key: 'clicks', name: '클릭', aliases: ['clicks', 'click', '클릭', '클릭수'] },
        { key: 'cost', name: '비용', aliases: ['cost', 'spend', '비용', '광고비', '지출', '집행비', '금액'] },
        { key: 'conversions', name: '전환', aliases: ['conversions', 'conversion', 'conv', '전환', '전환수'] },
      ],
      sample: [['2026-11-01', '브랜드 런칭', 12000, 240, 96000, 6], ['2026-11-02', '브랜드 런칭', 13500, 310, 124000, 9]],
    },
    histories: {
      label: '기록',
      cols: [
        { key: 'date', name: '날짜', aliases: ['date', '날짜', '일자'], required: true },
        { key: 'campaign', name: '캠페인', aliases: ['campaign', 'campaignname', '캠페인', '캠페인명', '캠페인이름'], required: true },
        { key: 'content', name: '내용', aliases: ['content', 'history', 'note', 'memo', '내용', '메모', '히스토리', '기록'], required: true },
      ],
      sample: [['2026-11-03', '브랜드 런칭', '메인 배너 교체, 타겟 연령 25-39로 확대']],
    },
    budgets: {
      label: '예산',
      cols: [
        { key: 'campaign', name: '캠페인', aliases: ['campaign', 'campaignname', '캠페인', '캠페인명', '캠페인이름'], required: true },
        { key: 'start', name: '시작일', aliases: ['start', 'startdate', '시작', '시작일'], required: true },
        { key: 'end', name: '종료일', aliases: ['end', 'enddate', '종료', '종료일'], required: true },
        { key: 'amount', name: '예산', aliases: ['amount', 'budget', '예산', '금액'], required: true },
        { key: 'memo', name: '메모', aliases: ['memo', 'note', '메모', '비고'] },
      ],
      sample: [['브랜드 런칭', '2026-11-01', '2026-11-30', 3000000, '11월 집행분']],
    },
  };

  function template(type) {
    var s = SCHEMAS[type];
    return [s.cols.map(function (c) { return c.name; })].concat(s.sample);
  }

  function blank(row) { return row.every(function (c) { return String(c).trim() === ''; }); }

  // rows(parse 결과) → { items, errors:[{line,message}], fatal }
  // items 의 캠페인은 이름(campaignName)으로 들어 있음 → 앱에서 id 로 연결
  function mapRows(type, rows) {
    var schema = SCHEMAS[type];
    if (!schema) return { items: [], errors: [], fatal: '알 수 없는 종류예요.' };
    if (rows.length < 2) return { items: [], errors: [], fatal: '데이터가 없어요. 첫 줄은 제목(열 이름), 둘째 줄부터 내용이어야 해요.' };
    if (rows.length - 1 > MAX_ROWS) return { items: [], errors: [], fatal: '한 번에 ' + MAX_ROWS + '행까지만 가져올 수 있어요.' };

    var header = rows[0].map(normHeader), idx = {};
    schema.cols.forEach(function (c) {
      var names = c.aliases.map(normHeader);
      idx[c.key] = header.findIndex(function (h) { return names.indexOf(h) !== -1; });
    });
    var missing = schema.cols.filter(function (c) { return c.required && idx[c.key] === -1; }).map(function (c) { return c.name; });
    if (missing.length) return { items: [], errors: [], fatal: '필요한 열이 없어요: ' + missing.join(', ') + ' (첫 줄의 열 이름을 확인해 주세요)' };
    if (type === 'performance' && !['impressions', 'clicks', 'cost', 'conversions'].some(function (k) { return idx[k] !== -1; })) {
      return { items: [], errors: [], fatal: '노출·클릭·비용·전환 중 하나 이상의 열이 필요해요.' };
    }

    var items = [], errors = [];
    // 내보낼 때 수식 방지용으로 붙인 ' (예: '=1+1)는 가져올 때 다시 뗌 → 내보내기→가져오기를 해도 원본 그대로
    function get(r, key) {
      var v = idx[key] === -1 ? '' : String(r[idx[key]] == null ? '' : r[idx[key]]).trim();
      return /^'[=+\-@]/.test(v) ? v.slice(1) : v;
    }

    for (var i = 1; i < rows.length; i++) {
      var r = rows[i], line = i + 1;
      if (blank(r)) continue;
      var err = null, item = {};

      var cname = get(r, 'campaign');
      if (!cname) err = '캠페인 이름이 비어 있어요.';
      else if (cname.length > 40) err = '캠페인 이름이 40자를 넘어요.';
      item.campaignName = cname;

      if (!err && type === 'performance') {
        item.date = calc.normDate(get(r, 'date'));
        if (!item.date) err = '날짜를 읽을 수 없어요. (예: 2026-11-08)';
        ['impressions', 'clicks', 'cost', 'conversions'].forEach(function (k) {
          if (err) return;
          var n = calc.num(get(r, k));
          if (isNaN(n) || n < 0 || n > 1e12) err = '"' + k + '" 값이 올바른 숫자가 아니에요.';
          else item[k] = k === 'cost' || k === 'conversions' ? Math.round(n * 100) / 100 : Math.round(n);
        });
      } else if (!err && type === 'histories') {
        item.date = calc.normDate(get(r, 'date'));
        item.content = get(r, 'content');
        if (!item.date) err = '날짜를 읽을 수 없어요. (예: 2026-11-08)';
        else if (!item.content) err = '내용이 비어 있어요.';
        else if (item.content.length > 1000) err = '내용이 1000자를 넘어요.';
      } else if (!err && type === 'budgets') {
        item.start = calc.normDate(get(r, 'start'));
        item.end = calc.normDate(get(r, 'end'));
        var amount = calc.num(get(r, 'amount'));
        item.memo = get(r, 'memo').slice(0, 100);
        if (!item.start || !item.end) err = '시작일/종료일을 읽을 수 없어요.';
        else if (item.end < item.start) err = '종료일이 시작일보다 앞이에요.';
        else if (isNaN(amount) || amount < 0 || amount > 1e13) err = '예산 금액이 올바른 숫자가 아니에요.';
        else item.amount = Math.round(amount);
      }

      if (err) errors.push({ line: line, message: err });
      else items.push(item);
    }
    return { items: items, errors: errors, fatal: null };
  }

  return { parse: parse, toCSV: toCSV, SCHEMAS: SCHEMAS, template: template, mapRows: mapRows, normHeader: normHeader, MAX_ROWS: MAX_ROWS };
});
