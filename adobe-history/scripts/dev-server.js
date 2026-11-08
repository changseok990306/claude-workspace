// 로컬 테스트용 개발 서버 (Vercel 없이 내 컴퓨터에서 히스토리 사이트 + API 실행)
//
// 실행 (adobe-history 폴더 안에서):
//   node --env-file=.env.local scripts/dev-server.js
// 접속: http://localhost:3000
//
// - 키·비밀번호는 .env.local 에서 읽어요 (코드에 없음, git 에 안 올라감)
// - 내 컴퓨터(127.0.0.1)에서만 접속됨
// - 공개되는 파일: index.html, css/, js/ 만. (.env.local, api/, supabase/ 는 브라우저로 열 수 없음)

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 3000;

const ROUTES = {
  '/api/campaigns': require(path.join(ROOT, 'api', 'campaigns.js')),
  '/api/histories': require(path.join(ROOT, 'api', 'histories.js')),
};

const PUBLIC_FILE = /^\/(index\.html|(css|js)\/[\w.-]+)$/;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`⚠️  환경변수가 없어요: ${missing.join(', ')}`);
  console.error('   이렇게 실행하세요:  node --env-file=.env.local scripts/dev-server.js');
  process.exit(1);
}
// ADMIN_PASSWORD 는 선택: 있으면 잠금 모드, 없으면 공개 모드
console.log(process.env.ADMIN_PASSWORD ? '🔒 잠금 모드 (비밀번호 필요)' : '🌐 공개 모드 (비밀번호 없음)');

http
  .createServer((req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent((req.url || '/').split('?')[0]);
    } catch {
      res.statusCode = 400;
      return res.end('Bad request');
    }

    const handler = ROUTES[pathname];
    if (handler) {
      // Vercel 처럼 JSON 본문을 미리 읽어서 req.body 로 넘겨 줌
      let raw = '';
      req.on('data', (c) => {
        raw += c;
        if (raw.length > 20_000) req.destroy();
      });
      req.on('end', () => {
        if (raw && /json/.test(req.headers['content-type'] || '')) {
          try { req.body = JSON.parse(raw); } catch { req.body = '{bad json'; }
        }
        handler(req, res);
      });
      return;
    }

    const rel = pathname === '/' ? '/index.html' : pathname;
    if (!PUBLIC_FILE.test(rel)) {
      res.statusCode = 404;
      return res.end('Not found');
    }
    fs.readFile(path.join(ROOT, rel), (err, data) => {
      if (err) {
        res.statusCode = 404;
        return res.end('Not found');
      }
      res.setHeader('Content-Type', TYPES[path.extname(rel).toLowerCase()] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-store');
      res.end(data);
    });
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`✅ 어도비 히스토리 로컬 서버 실행 중 → http://localhost:${PORT}`);
    console.log('   (끄려면 Ctrl + C)');
  });
