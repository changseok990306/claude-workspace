// POST /api/ops   { ops: [{ c: 컬렉션, id, item: 항목 | null(삭제) }, ...] }
// 누구나 보낼 수 있는 공개 주소이므로, 보낸 값은 전부 서버가 다시 검증하고 크기·횟수를 제한해요.
//   - 항목은 schema.js 의 같은 규칙으로 정리해서 저장 (이상하면 그 항목만 거절)
//   - 삭제는 지우지 않고 deleted=true 표시만 (실수로 지워도 Supabase 에서 되살릴 수 있음)

const { send, clientIp, readJson, makeLimiter, missingEnv, sb } = require('./_lib');
const { COLLECTIONS, ID_RE, cleanItem } = require('../js/schema.js');

const MAX_BODY = 500 * 1024;
const MAX_OPS = 200;
const MAX_ITEM_JSON = 20000;
const allowRequest = makeLimiter(90, 60 * 1000);        // 1분에 요청 90번
const allowOps = makeLimiter(1500, 60 * 1000);          // 1분에 변경 1500개

// 본문을 읽지 않고 응답할 때는 남은 본문을 버려야 연결이 끊기지 않아요
function reply(req, res, status, body) {
  if (typeof req.resume === 'function') req.resume();
  return send(res, status, body);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return reply(req, res, 405, { ok: false, error: '허용되지 않는 요청이에요.' }); }
  if (missingEnv().length) return reply(req, res, 503, { ok: false, error: '서버 설정이 아직 안 되어 있어요.' });

  const ip = clientIp(req);
  if (!allowRequest(ip, 1)) return reply(req, res, 429, { ok: false, error: '요청이 너무 많아요. 잠시 뒤 다시 해 주세요.' });

  let body;
  try { body = await readJson(req, MAX_BODY); } catch (e) {
    return reply(req, res, e && e.message === 'too large' ? 413 : 400, { ok: false, error: '요청 내용이 올바르지 않거나 너무 커요.' });
  }
  const ops = body && Array.isArray(body.ops) ? body.ops : null;
  if (!ops || !ops.length || ops.length > MAX_OPS) return send(res, 400, { ok: false, error: `변경은 한 번에 1~${MAX_OPS}개까지 보낼 수 있어요.` });
  if (!allowOps(ip, ops.length)) return send(res, 429, { ok: false, error: '변경이 너무 많아요. 잠시 뒤 다시 해 주세요.' });

  const upserts = new Map(), deletes = new Map(), rejected = [];
  const reject = (op, reason) => rejected.push({ c: op && op.c, id: op && op.id, reason });
  for (const op of ops) {
    if (!op || typeof op !== 'object' || !COLLECTIONS.includes(op.c) || typeof op.id !== 'string' || !ID_RE.test(op.id)) { reject(op, '항목 정보가 올바르지 않아요'); continue; }
    const key = `${op.c}|${op.id}`;
    if (op.item === null) { upserts.delete(key); deletes.set(key, op); continue; }
    const clean = cleanItem(op.c, op.item, {});             // 서버는 id 를 새로 만들지 않음(없거나 이상하면 거절)
    if (!clean || clean.id !== op.id) { reject(op, '내용이 올바르지 않아요'); continue; }
    if (JSON.stringify(clean).length > MAX_ITEM_JSON) { reject(op, '항목이 너무 커요'); continue; }
    deletes.delete(key);
    upserts.set(key, { collection: op.c, id: op.id, data: clean, deleted: false });
  }

  if (upserts.size) {
    const r = await sb('POST', 'on_conflict=collection,id', { body: [...upserts.values()], prefer: 'resolution=merge-duplicates,return=minimal' });
    if (!r.ok) return send(res, 502, { ok: false, error: '저장소에 저장하지 못했어요.' });
  }
  const byCollection = {};
  for (const op of deletes.values()) (byCollection[op.c] = byCollection[op.c] || []).push(op.id);
  for (const [c, ids] of Object.entries(byCollection)) {
    const r = await sb('PATCH', `collection=eq.${c}&id=in.(${ids.join(',')})`, { body: { deleted: true }, prefer: 'return=minimal' });
    if (!r.ok) return send(res, 502, { ok: false, error: '저장소에서 삭제하지 못했어요.' });
  }
  return send(res, 200, { ok: true, applied: upserts.size + deletes.size, rejected });
};
