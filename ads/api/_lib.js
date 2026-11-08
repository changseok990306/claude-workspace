// 서버 함수 공통 도우미 (파일명이 _ 로 시작하면 Vercel 이 주소로 공개하지 않음)
//
// 키는 코드에 쓰지 않고 Vercel 환경변수에서만 읽어요 (포트폴리오 방명록과 같은 이름):
//   SUPABASE_URL, SUPABASE_ANON_KEY   (anon 공개 키만 사용 — service_role 금지)

const TABLE = 'ads_items';

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  return (xff ? String(xff).split(',')[0].trim() : req.socket && req.socket.remoteAddress) || 'unknown';
}

// 요청 본문(JSON)을 읽음. maxBytes 를 넘으면 에러
async function readJson(req, maxBytes) {
  const len = Number(req.headers['content-length'] || 0);
  if (len > maxBytes) throw new Error('too large');
  if (req.body !== undefined && req.body !== null) {
    const b = typeof req.body === 'string' ? req.body : null;
    if (b !== null) { if (b.length > maxBytes) throw new Error('too large'); return JSON.parse(b); }
    if (JSON.stringify(req.body).length > maxBytes) throw new Error('too large');
    return req.body;
  }
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > maxBytes) throw new Error('too large');
  }
  return raw ? JSON.parse(raw) : {};
}

// "1분에 N번" 제한 (서버가 새로 뜨면 초기화되는 최소한의 방어)
function makeLimiter(max, windowMs) {
  const hits = new Map();
  return function allow(ip, cost) {
    const now = Date.now();
    if (hits.size > 2000) hits.clear();
    const rec = hits.get(ip);
    if (!rec || now - rec.first >= windowMs) { hits.set(ip, { first: now, count: cost || 1 }); return true; }
    rec.count += cost || 1;
    return rec.count <= max;
  };
}

function env() {
  return { url: process.env.SUPABASE_URL || '', key: process.env.SUPABASE_ANON_KEY || '' };
}
function missingEnv() {
  const e = env();
  return [!e.url && 'SUPABASE_URL', !e.key && 'SUPABASE_ANON_KEY'].filter(Boolean);
}

// Supabase REST 호출. 성공: { ok:true, data } / 실패: { ok:false, status, code, net } (원인은 서버 로그에만, 키는 기록 안 함)
async function sb(method, query, opts) {
  opts = opts || {};
  const e = env();
  const endpoint = `${e.url.replace(/\/+$/, '')}/rest/v1/${TABLE}${query ? `?${query}` : ''}`;
  const headers = { apikey: e.key, Authorization: `Bearer ${e.key}` };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.prefer) headers.Prefer = opts.prefer;
  let r;
  try {
    r = await fetch(endpoint, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  } catch (err) {
    console.error('[ads] Supabase 연결 실패:', err && err.message);
    return { ok: false, status: 0, net: true };
  }
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (err) { /* 본문이 JSON 이 아님 */ }
  if (!r.ok) {
    console.error(`[ads] Supabase ${method} →`, r.status, text.slice(0, 300));
    return { ok: false, status: r.status, code: json && json.code };
  }
  return { ok: true, data: json };
}

module.exports = { TABLE, send, clientIp, readJson, makeLimiter, env, missingEnv, sb };
