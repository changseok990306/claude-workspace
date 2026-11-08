// 로컬 테스트용 개발 서버 (Vercel 없이 내 컴퓨터에서 포트폴리오 + 방명록 API 실행)
//
// 실행:  node --env-file=.env.local scripts/dev-server.js
// 접속:  http://localhost:3000
//
// - 키는 .env.local 에서 읽어요 (코드에 없음, git 에 안 올라감)
// - 내 컴퓨터(127.0.0.1)에서만 접속됨 — 같은 와이파이의 다른 기기는 접속 불가

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE = path.join(ROOT, 'portfolio');
const PORT = Number(process.env.PORT) || 3000;
const handler = require(path.join(ROOT, 'api', 'guestbook.js'));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
};

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error('⚠️  SUPABASE_URL / SUPABASE_ANON_KEY 가 없어요.');
  console.error('   이렇게 실행하세요:  node --env-file=.env.local scripts/dev-server.js');
  process.exit(1);
}

http
  .createServer((req, res) => {
    const pathname = decodeURIComponent((req.url || '/').split('?')[0]);

    // 방명록 API — Vercel 처럼 JSON 본문을 미리 읽어서 req.body 로 넘겨 줌
    if (pathname === '/api/guestbook') {
      let raw = '';
      req.on('data', (c) => {
        raw += c;
        if (raw.length > 10_000) req.destroy();
      });
      req.on('end', () => {
        if (raw && /json/.test(req.headers['content-type'] || '')) {
          try { req.body = JSON.parse(raw); } catch { req.body = '{bad json'; }
        }
        handler(req, res);
      });
      return;
    }

    // 정적 파일 (portfolio/ 폴더 안에서만)
    const file = path.resolve(SITE, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (file !== SITE && !file.startsWith(SITE + path.sep)) {
      res.statusCode = 403;
      return res.end('Forbidden');
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.statusCode = 404;
        return res.end('Not found');
      }
      res.setHeader('Content-Type', TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-store');
      res.end(data);
    });
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`✅ 포트폴리오 로컬 서버 실행 중 → http://localhost:${PORT}`);
    console.log('   (끄려면 Ctrl + C)');
  });
