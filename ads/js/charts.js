// 꺾은선 차트 (외부 라이브러리 없이 SVG 로 직접 그림)
//   line(container, { keys, bucket, series:[{label, color, values}], fmt, ariaLabel })
//   - values 에 null 이 있으면 그 구간은 선을 끊음
//   - 마우스/터치를 올리면 그 날짜의 값을 말풍선으로 보여 줌
(function () {
  'use strict';
  var A = window.Ads, el = A.ui.el;
  var NS = 'http://www.w3.org/2000/svg';
  var W = 760, H = 280, M = { l: 62, r: 16, t: 14, b: 30 };

  function s(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    for (var i = 2; i < arguments.length; i++) if (arguments[i]) n.append(arguments[i]);
    return n;
  }

  // 눈금 4칸이 깔끔한 숫자(1·2·2.5·5 × 10^n)가 되도록 최대값을 올림
  function niceStep(max) {
    if (!(max > 0)) return 0.25;
    var raw = max / 4, exp = Math.pow(10, Math.floor(Math.log10(raw)));
    var f = [1, 2, 2.5, 5, 10].find(function (x) { return x * exp >= raw - 1e-12; });
    return f * exp;
  }
  function keyLabel(key, bucket) {
    if (bucket === 'month') return key.slice(0, 7);
    var md = key.slice(5).replace('-', '/').replace(/^0/, '').replace('/0', '/');
    return bucket === 'week' ? md + ' 주' : md;
  }

  function line(container, o) {
    container.replaceChildren();
    var hasValue = o.series.some(function (se) { return se.values.some(function (v) { return v !== null; }); });
    if (!o.keys.length || !hasValue) {
      container.append(el('div', { class: 'chart__empty', text: '표시할 데이터가 없어요. 성과를 입력하거나 CSV로 가져오면 여기에 차트가 나와요.' }));
      return;
    }

    var n = o.keys.length, max = 0;
    o.series.forEach(function (se) { se.values.forEach(function (v) { if (v !== null && v > max) max = v; }); });
    var step = niceStep(max), top = step * 4;
    var iw = W - M.l - M.r, ih = H - M.t - M.b;
    var X = function (i) { return n === 1 ? M.l + iw / 2 : M.l + (i * iw) / (n - 1); };
    var Y = function (v) { return M.t + ih - (v / top) * ih; };

    var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': o.ariaLabel || '추이 차트', preserveAspectRatio: 'xMidYMid meet' });

    // 가로 눈금선 + 숫자
    for (var g = 0; g <= 4; g++) {
      var gy = Y(step * g);
      svg.append(s('line', { class: 'chart__grid', x1: M.l, x2: W - M.r, y1: gy, y2: gy }));
      var t = s('text', { class: 'chart__label', x: M.l - 8, y: gy + 4, 'text-anchor': 'end' });
      t.textContent = o.axis ? o.axis(step * g) : A.ui.fmtCompact(step * g);
      svg.append(t);
    }
    // 날짜 눈금 (최대 6개)
    var want = Math.min(n, 6), shown = {};
    for (var k = 0; k < want; k++) shown[want === 1 ? 0 : Math.round((k * (n - 1)) / (want - 1))] = true;
    Object.keys(shown).forEach(function (i) {
      var tx = s('text', { class: 'chart__label', x: X(+i), y: H - 8, 'text-anchor': +i === 0 && n > 1 ? 'start' : +i === n - 1 && n > 1 ? 'end' : 'middle' });
      tx.textContent = keyLabel(o.keys[i], o.bucket);
      svg.append(tx);
    });

    // 선 + 점
    o.series.forEach(function (se) {
      var d = '', pen = false;
      se.values.forEach(function (v, i) {
        if (v === null) { pen = false; return; }
        d += (pen ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1) + ' ';
        pen = true;
      });
      var grp = s('g', { 'data-c': se.color });
      grp.append(s('path', { class: 'chart__line', d: d.trim() }));
      if (n <= 45) se.values.forEach(function (v, i) { if (v !== null) grp.append(s('circle', { class: 'chart__dot', cx: X(i), cy: Y(v), r: 3 })); });
      svg.append(grp);
    });

    // 마우스를 올릴 때 보이는 세로 가이드선 + 말풍선
    var guide = s('line', { class: 'chart__guide', y1: M.t, y2: H - M.b, visibility: 'hidden' });
    var cover = s('rect', { x: M.l, y: M.t, width: iw, height: ih, fill: 'transparent' });
    svg.append(guide, cover);

    var tip = el('div', { class: 'chart__tip', hidden: true });
    function at(clientX) {
      var r = svg.getBoundingClientRect();
      var x = ((clientX - r.left) / r.width) * W;
      var i = n === 1 ? 0 : Math.round(((x - M.l) / iw) * (n - 1));
      return Math.max(0, Math.min(n - 1, i));
    }
    function show(e) {
      var i = at(e.clientX), r = svg.getBoundingClientRect(), px = (X(i) / W) * r.width;
      guide.setAttribute('x1', X(i)); guide.setAttribute('x2', X(i)); guide.setAttribute('visibility', 'visible');
      tip.replaceChildren(el('b', { text: o.keys[i] + (o.bucket === 'week' ? ' (주 시작)' : '') }));
      o.series.forEach(function (se) {
        var v = se.values[i];
        tip.append(el('div', { 'data-c': se.color }, el('span', {}, el('i'), se.label), el('span', { text: v === null ? '-' : (o.fmt ? o.fmt(v) : A.ui.fmtNum(v)) })));
      });
      tip.hidden = false;
      var w = tip.offsetWidth;
      tip.style.left = Math.max(0, Math.min(r.width - w, px + 12 > r.width - w ? px - w - 12 : px + 12)) + 'px';
    }
    function hide() { guide.setAttribute('visibility', 'hidden'); tip.hidden = true; }
    cover.addEventListener('pointermove', show);
    cover.addEventListener('pointerdown', show);
    cover.addEventListener('pointerleave', hide);

    container.append(svg, tip);
    container.append(el('div', { class: 'legend' }, o.series.map(function (se) {
      return el('span', { class: 'legend__item', 'data-c': se.color, text: se.label });
    })));
  }

  A.charts = { line: line, niceStep: niceStep };
})();
