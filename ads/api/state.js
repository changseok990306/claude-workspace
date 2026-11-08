// GET /api/state            → 지금 있는 모든 항목 (삭제된 것 제외)   { full:true, items, cursor }
// GET /api/state?since=ISO  → 그 시각 이후 바뀐 항목 (삭제 표시 포함)   { full:false, items, cursor }
//   items: [{ c: 컬렉션, id, d: 데이터, x: 삭제됨 여부, t: 바뀐 시각 }]
//   cursor: 다음에 since 로 쓸 시각 (바뀐 항목이 없으면 null/이전 값)

const { send, clientIp, makeLimiter, missingEnv, sb } = require('./_lib');
const { COLLECTIONS } = require('../js/schema.js');

const PAGE = 1000;              // Supabase 가 한 번에 주는 최대 행 수에 맞춤
const MAX_ROWS = 20000;
const allow = makeLimiter(180, 60 * 1000);

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return send(res, 405, { ok: false, error: '허용되지 않는 요청이에요.' }); }
  if (missingEnv().length) return send(res, 503, { ok: false, error: '서버 설정이 아직 안 되어 있어요.' });
  if (!allow(clientIp(req), 1)) return send(res, 429, { ok: false, error: '요청이 너무 많아요. 잠시 뒤 다시 해 주세요.' });

  const since = new URL(req.url, 'http://x').searchParams.get('since');
  if (since !== null && (!/^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:?\d{2})?$/.test(since) || isNaN(Date.parse(since)))) {
    return send(res, 400, { ok: false, error: 'since 형식이 올바르지 않아요.' });
  }

  const filter = since ? `updated_at=gt.${encodeURIComponent(since)}` : 'deleted=eq.false';
  const rows = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
    const r = await sb('GET', `select=collection,id,data,deleted,updated_at&${filter}&order=updated_at.asc,collection.asc,id.asc&limit=${PAGE}&offset=${offset}`);
    if (!r.ok) return send(res, 502, { ok: false, error: '저장소에서 읽어 오지 못했어요.' });
    rows.push(...r.data);
    if (r.data.length < PAGE) break;
  }

  const items = rows.filter((x) => COLLECTIONS.includes(x.collection))
    .map((x) => ({ c: x.collection, id: x.id, d: x.deleted ? null : x.data, x: !!x.deleted, t: x.updated_at }));
  const cursor = items.length ? items.reduce((m, x) => (x.t > m ? x.t : m), items[0].t) : (since || null);
  return send(res, 200, { ok: true, full: !since, items, cursor });
};
