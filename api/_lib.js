// 히스토리 API 공통 도우미 (파일명이 _ 로 시작하면 Vercel 이 URL 로 공개하지 않음)
//
// 환경변수(코드에 값 없음) — 방명록과 같은 것을 씁니다:
//   SUPABASE_URL, SUPABASE_ANON_KEY   (anon 공개 키만 사용 — service_role 금지)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLORS = ['indigo', 'teal', 'amber', 'rose', 'green', 'violet', 'orange', 'slate'];

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

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  }
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 20_000) throw new Error('too large');
  }
  return raw ? JSON.parse(raw) : {};
}

// 쓰기 제한: 같은 IP 가 1분에 60번을 넘게 추가·삭제·수정하면 잠시 막음
// (서버가 새로 뜨면 초기화되는 "최소한의" 방어 — 읽기(GET)는 제한 안 함)
const WRITE_WINDOW_MS = 60 * 1000;
const WRITE_MAX = 60;
const writes = new Map();

// 통과하면 true, 막았으면 응답을 이미 보냈으니 false
function allowRequest(req, res) {
  if (req.method === 'GET') return true;
  const ip = clientIp(req);
  const now = Date.now();
  if (writes.size > 1000) writes.clear();
  const rec = writes.get(ip);
  if (!rec || now - rec.first >= WRITE_WINDOW_MS) {
    writes.set(ip, { first: now, count: 1 });
    return true;
  }
  rec.count += 1;
  if (rec.count > WRITE_MAX) {
    send(res, 429, { error: '요청이 너무 많아요. 잠시 후 다시 해 주세요.' });
    return false;
  }
  return true;
}

function configured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

// Supabase REST 호출. 성공: { ok:true, data }   실패: { ok:false, status, code }
// 실패 원인은 서버 로그에만 남기고 키는 기록하지 않음
async function sb(table, { method = 'GET', query = '', body, returning = false } = {}) {
  const key = process.env.SUPABASE_ANON_KEY;
  const endpoint = `${process.env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/${table}${query ? `?${query}` : ''}`;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') headers.Prefer = returning ? 'return=representation' : 'return=minimal';

  const r = await fetch(endpoint, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}

  if (!r.ok) {
    console.error(`[history] Supabase ${method} ${table} →`, r.status, text.slice(0, 300));
    return { ok: false, status: r.status, code: json && json.code };
  }
  return { ok: true, data: json };
}

module.exports = { UUID_RE, COLORS, send, readBody, allowRequest, configured, sb };
