// 공통 도우미 (파일명이 _ 로 시작하면 Vercel 이 URL 로 공개하지 않음)
//
// 환경변수(코드에 값 없음):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_PASSWORD

const crypto = require('crypto');

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

// ---- 비밀번호 확인 -------------------------------------------------------
// 틀린 시도가 1분에 5번 넘으면 그 IP 는 잠시 막음 (서버가 새로 뜨면 초기화되는 최소한의 방어)
const FAIL_WINDOW_MS = 60 * 1000;
const FAIL_MAX = 5;
const fails = new Map();

function sameSecret(a, b) {
  // 길이가 달라도 시간 차이가 안 나도록 해시한 뒤 비교
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// ---- 공개 모드용 쓰기 제한 ----------------------------------------------------
// 같은 IP 가 1분에 60번을 넘게 추가·삭제하면 잠시 막음 (자동 프로그램이 한꺼번에 지우는 것을 늦추는 용도)
const WRITE_WINDOW_MS = 60 * 1000;
const WRITE_MAX = 60;
const writes = new Map();

function limitWrites(req, res) {
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

// 통과하면 true, 아니면 응답을 이미 보냈으니 false
//   ADMIN_PASSWORD 가 설정돼 있으면 → 잠금 모드 (읽기·쓰기 모두 비밀번호 필요)
//   ADMIN_PASSWORD 가 없으면       → 공개 모드 (누구나 읽기·쓰기 가능, 쓰기는 횟수 제한)
function requireAuth(req, res) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return req.method === 'GET' ? true : limitWrites(req, res);
  }

  const ip = clientIp(req);
  const now = Date.now();
  const rec = fails.get(ip);
  if (rec && now - rec.first < FAIL_WINDOW_MS && rec.count >= FAIL_MAX) {
    send(res, 429, { error: '시도가 너무 많아요. 1분 뒤에 다시 해 주세요.' });
    return false;
  }

  const given = req.headers['x-admin-password'];
  if (typeof given === 'string' && sameSecret(given, expected)) {
    fails.delete(ip);
    return true;
  }

  if (!rec || now - rec.first >= FAIL_WINDOW_MS) fails.set(ip, { first: now, count: 1 });
  else rec.count += 1;
  send(res, 401, { error: '비밀번호가 맞지 않아요.' });
  return false;
}

// ---- Supabase 호출 --------------------------------------------------------
// 성공: { ok:true, data }   실패: { ok:false, status, code }  (원인은 서버 로그에만, 키는 기록 안 함)
async function sb(table, { method = 'GET', query = '', body, returning = false } = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const endpoint = `${url.replace(/\/+$/, '')}/rest/v1/${table}${query ? `?${query}` : ''}`;
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
    console.error(`[adobe-history] Supabase ${method} ${table} →`, r.status, text.slice(0, 300));
    return { ok: false, status: r.status, code: json && json.code };
  }
  return { ok: true, data: json };
}

function configured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

module.exports = { UUID_RE, COLORS, send, readBody, requireAuth, sb, configured };
