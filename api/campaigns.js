// 캠페인 API (Vercel 서버리스 함수)
//   GET    /api/campaigns              → 전체 목록 (만든 순서)
//   POST   /api/campaigns              → { name, color }
//   PATCH  /api/campaigns?id=<uuid>    → { name?, color? }
//   DELETE /api/campaigns?id=<uuid>    → 삭제 (소속 히스토리도 함께 삭제됨)

const { UUID_RE, COLORS, send, readBody, allowRequest, configured, sb } = require('./_lib');

const NAME_MAX = 40;

function parseId(req) {
  const id = new URL(req.url, 'http://x').searchParams.get('id');
  return id && UUID_RE.test(id) ? id : null;
}

function validate(data, { partial }) {
  const out = {};
  if (!partial || data.name !== undefined) {
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    if (!name || name.length > NAME_MAX) return { error: `캠페인 이름은 1~${NAME_MAX}자로 적어 주세요.` };
    out.name = name;
  }
  if (!partial || data.color !== undefined) {
    const color = data.color === undefined ? 'indigo' : data.color;
    if (!COLORS.includes(color)) return { error: '색상 값이 올바르지 않아요.' };
    out.color = color;
  }
  if (!Object.keys(out).length) return { error: '바꿀 내용이 없어요.' };
  return { value: out };
}

module.exports = async function handler(req, res) {
  if (!configured()) return send(res, 500, { error: '서버 설정이 아직 안 되어 있어요.' });
  if (!allowRequest(req, res)) return;

  try {
    if (req.method === 'GET') {
      const r = await sb('campaigns', { query: 'select=id,name,color,created_at&order=created_at.asc' });
      if (!r.ok) return send(res, 502, { error: '캠페인을 불러오지 못했어요.' });
      return send(res, 200, { items: r.data });
    }

    if (req.method === 'POST' || req.method === 'PATCH') {
      let data;
      try { data = await readBody(req); } catch { return send(res, 400, { error: '잘못된 요청이에요.' }); }
      const v = validate(data || {}, { partial: req.method === 'PATCH' });
      if (v.error) return send(res, 400, { error: v.error });

      if (req.method === 'POST') {
        const r = await sb('campaigns', { method: 'POST', body: v.value, returning: true });
        if (!r.ok) return send(res, 502, { error: '저장하지 못했어요.' });
        return send(res, 201, { item: r.data[0] });
      }

      const id = parseId(req);
      if (!id) return send(res, 400, { error: '캠페인 id가 올바르지 않아요.' });
      const r = await sb('campaigns', { method: 'PATCH', query: `id=eq.${id}`, body: v.value, returning: true });
      if (!r.ok) return send(res, 502, { error: '수정하지 못했어요.' });
      if (!r.data.length) return send(res, 404, { error: '없는 캠페인이에요.' });
      return send(res, 200, { item: r.data[0] });
    }

    if (req.method === 'DELETE') {
      const id = parseId(req);
      if (!id) return send(res, 400, { error: '캠페인 id가 올바르지 않아요.' });
      const r = await sb('campaigns', { method: 'DELETE', query: `id=eq.${id}`, returning: true });
      if (!r.ok) return send(res, 502, { error: '삭제하지 못했어요.' });
      if (!r.data.length) return send(res, 404, { error: '없는 캠페인이에요.' });
      return send(res, 200, { ok: true });
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return send(res, 405, { error: '허용되지 않는 요청이에요.' });
  } catch {
    return send(res, 500, { error: '일시적인 오류예요. 잠시 후 다시 시도해 주세요.' });
  }
};
