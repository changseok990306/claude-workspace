// GET /api/health — 설정 점검. 화면이 "서버(공유 저장소)를 쓸 수 있는지"와 안 될 때의 정확한 원인을 알려 줌
//   { ok: true }  또는  { ok: false, reason: 'env'|'table'|'key'|'net'|'db', message: '…' }

const { send, missingEnv, sb } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return send(res, 405, { ok: false, message: '허용되지 않는 요청이에요.' }); }

  const missing = missingEnv();
  if (missing.length) {
    return send(res, 200, {
      ok: false, reason: 'env', missing,
      message: `서버에 환경변수가 없어요: ${missing.join(', ')}. Vercel → 프로젝트 → Settings → Environment Variables 에 추가한 뒤 Redeploy 해 주세요.`,
    });
  }

  const r = await sb('GET', 'select=id&limit=1');
  if (r.ok) return send(res, 200, { ok: true });
  if (r.net) return send(res, 200, { ok: false, reason: 'net', message: 'Supabase 에 연결할 수 없어요. SUPABASE_URL 값이 맞는지 확인해 주세요.' });
  if (r.status === 401 || r.status === 403) {
    return send(res, 200, { ok: false, reason: 'key', message: 'Supabase 키가 올바르지 않아요. SUPABASE_ANON_KEY 에 anon(공개) 키를 넣었는지 확인해 주세요.' });
  }
  if (r.status === 404 || r.code === 'PGRST205' || r.code === '42P01') {
    return send(res, 200, { ok: false, reason: 'table', message: 'Supabase 에 ads_items 테이블이 없어요. SQL Editor 에서 ads/supabase/ads_items.sql 을 실행해 주세요.' });
  }
  return send(res, 200, { ok: false, reason: 'db', message: `Supabase 가 오류로 응답했어요 (${r.status}). 잠시 뒤 다시 시도해 주세요.` });
};
