// 히스토리 API
//   GET    /api/histories                    → 전체 (날짜 최신순)
//   GET    /api/histories?campaign_id=<uuid> → 한 캠페인만
//   POST   /api/histories                    → { campaign_id, content, event_date: "YYYY-MM-DD" }
//   DELETE /api/histories?id=<숫자>           → 삭제
// 모든 요청에 x-admin-password 헤더 필요.

const { UUID_RE, send, readBody, requireAuth, sb, configured } = require('./_lib');

const CONTENT_MAX = 1000;
const LIST_LIMIT = 2000;
const FIELDS = 'id,campaign_id,content,event_date,created_at';

// "2026-02-30" 같은 없는 날짜는 거절
function validDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (!configured()) return send(res, 500, { error: '서버 설정이 아직 안 되어 있어요.' });

  try {
    const params = new URL(req.url, 'http://x').searchParams;

    if (req.method === 'GET') {
      const cid = params.get('campaign_id');
      if (cid && !UUID_RE.test(cid)) return send(res, 400, { error: '캠페인 id가 올바르지 않아요.' });
      const filter = cid ? `&campaign_id=eq.${cid}` : '';
      const r = await sb('histories', {
        query: `select=${FIELDS}&order=event_date.desc,created_at.desc&limit=${LIST_LIMIT}${filter}`,
      });
      if (!r.ok) return send(res, 502, { error: '히스토리를 불러오지 못했어요.' });
      return send(res, 200, { items: r.data });
    }

    if (req.method === 'POST') {
      let data;
      try { data = await readBody(req); } catch { return send(res, 400, { error: '잘못된 요청이에요.' }); }
      data = data || {};

      const content = typeof data.content === 'string' ? data.content.trim() : '';
      if (!content || content.length > CONTENT_MAX) {
        return send(res, 400, { error: `내용은 1~${CONTENT_MAX}자로 적어 주세요.` });
      }
      if (!validDate(data.event_date)) {
        return send(res, 400, { error: '날짜를 올바르게 입력해 주세요. (예: 2026-11-08)' });
      }
      if (typeof data.campaign_id !== 'string' || !UUID_RE.test(data.campaign_id)) {
        return send(res, 400, { error: '캠페인을 선택해 주세요.' });
      }

      const r = await sb('histories', {
        method: 'POST',
        returning: true,
        body: { campaign_id: data.campaign_id, content, event_date: data.event_date },
      });
      if (!r.ok) {
        // 23503 = 없는 캠페인을 가리킴
        if (r.code === '23503') return send(res, 400, { error: '없는 캠페인이에요.' });
        return send(res, 502, { error: '저장하지 못했어요.' });
      }
      return send(res, 201, { item: r.data[0] });
    }

    if (req.method === 'DELETE') {
      const id = params.get('id');
      if (!id || !/^\d{1,18}$/.test(id)) return send(res, 400, { error: '히스토리 id가 올바르지 않아요.' });
      const r = await sb('histories', { method: 'DELETE', query: `id=eq.${id}`, returning: true });
      if (!r.ok) return send(res, 502, { error: '삭제하지 못했어요.' });
      if (!r.data.length) return send(res, 404, { error: '없는 히스토리예요.' });
      return send(res, 200, { ok: true });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return send(res, 405, { error: '허용되지 않는 요청이에요.' });
  } catch {
    return send(res, 500, { error: '일시적인 오류예요. 잠시 후 다시 시도해 주세요.' });
  }
};
