# 📒 작업 기록 (progress)

> **append-only** — 기존 내용은 지우거나 고치지 않고, 아래에 계속 추가만 합니다.
> 형식: `## 날짜 — 제목` + 한 일 요약

---

## 2026-11-01 — 작업 환경 구축

1. `tasks/` 폴더 생성, `todo.md`(할 일)·`progress.md`(한 일 기록) 작성
2. `SECURITY.md` 작성 — 키 노출 시 비상 대응 매뉴얼 (OpenRouter / Oracle / WordPress)
3. `README.md` 작성 — 폴더 구조와 사용법 정리

- 메모: 현재 `.env`, `~/.ssh/` 폴더는 아직 없음 → 필요할 때 생성 예정

## 2026-11-01 — 다운로드 폴더 정리

1. `Downloads`에 `images`(110), `docs`(237, psd 포함), `misc`(192) 폴더를 만들고 최상위 파일 539개 이동
2. 기존 폴더 58개와 `desktop.ini`는 그대로 둠
3. 이동 기록: `tasks/move-log.csv` (From → To, 되돌리기용)
4. 검증: 성공 539 / 실패 0, 이름 겹침 0

## 2026-11-01 — 포트폴리오 웹페이지

1. `portfolio/index.html` 생성 (소개 · 경력 3개 · 연락처, 반응형, 다크모드 자동)
2. CLAUDE.md에는 이름·직업만 있어서 경력·연락처는 `[ ]` 노란 칸으로 비워 둠
3. 외부 서비스에 올리지 않음 (내 컴퓨터에서만 열림)

## 2026-11-01 — 포트폴리오 방명록 기능 (브랜치 `guestbook`)

1. `supabase/guestbook.sql` — 테이블(이름·메시지·작성시간·숨김) + RLS(누구나 읽기/쓰기, 수정·삭제 불가)
2. `api/guestbook.js` — Vercel 서버 함수(GET 목록 / POST 작성). 키는 환경변수(`SUPABASE_URL`, `SUPABASE_ANON_KEY`)에서만 읽음. 입력 검증·봇 함정·30초 도배 방지
3. `portfolio/index.html` — 방명록 섹션(입력창+목록), 메뉴 링크, 남색 테마 유지. 글은 `textContent`로만 출력
4. `.env.example`(키 이름만) 추가, `.gitignore`에 예외 규칙, README에 설정법 추가
5. 검증: 가짜 Supabase로 API 9가지 규칙 테스트 통과, 악성 스크립트 글이 글자 그대로 표시됨을 화면으로 확인
- 미확인: 진짜 Supabase 연결 (사용자가 프로젝트 생성·환경변수 등록 후 배포해서 확인 필요)
- 메모: 도배 방지는 서버 메모리 기반이라 완벽하지 않음 → 스팸이 늘면 캡차 추가 검토

## 2026-11-01 — 방명록을 `messages` 테이블 + 로컬 테스트 방식으로 수정 (브랜치 `guestbook`)

1. `supabase/guestbook.sql` → `supabase/messages.sql`로 이름 변경 + 수정: `messages`(id, name, content, created_at), RLS 누구나 읽기/쓰기, 수정·삭제 불가
2. `api/guestbook.js`, `portfolio/index.html`을 `content` 컬럼 기준으로 수정. Supabase 오류 시 서버 로그에 원인 기록(키는 기록 안 함)
3. `.env.local`에 Supabase URL·anon 키 저장 (git 제외 확인). 키 종류 확인: role=anon, URL과 프로젝트 일치
4. `scripts/dev-server.js` 추가 — `node --env-file=.env.local scripts/dev-server.js` 로 로컬 테스트
5. README에 로컬 테스트 방법 추가
6. 검증: 진짜 Supabase 연결 확인(키·URL 정상, 응답: 테이블 없음 `PGRST205`), 가짜 DB로 글쓰기→목록 표시, 입력 검사, 경로 탈출 차단 통과
- 미확인: 진짜 DB에 글쓰기 (테이블이 아직 없음 → 사용자가 SQL Editor에서 `messages.sql` 실행 필요)

## 2026-11-08 — 어도비 캠페인 히스토리 홈페이지 (브랜치 `adobe-history`)

1. 계획(PRD·기술 방향) 작성 후 승인: 새 폴더 `adobe-history/`, 별도 Vercel 프로젝트(Root Directory=`adobe-history`), 저장소는 Supabase DB, 접근은 비밀번호 1개(`ADMIN_PASSWORD`)
2. `adobe-history/supabase/adobe_history.sql` — `campaigns`·`histories` 테이블, 캠페인 삭제 시 히스토리 연쇄 삭제, RLS 켜고 공개 정책 없음(서버 함수만 `service_role` 키로 접근), 예시 캠페인 4개
3. `adobe-history/api/` — `_lib.js`(비밀번호 확인·Supabase 호출), `campaigns.js`, `histories.js`. 입력 검증, 틀린 비밀번호 1분 5회 제한
4. `adobe-history/scripts/dev-server.js` — 로컬 서버(`index.html`·`css/`·`js/`만 공개), `vercel.json`, `.env.example`(이름만)
5. 화면: `index.html`, `css/style.css`, `js/api.js`, `js/app.js` — 캠페인 8색 톤, 히스토리 추가/삭제/날짜 입력, 날짜 최신순 타임라인, 실시간 검색(내용+날짜)·하이라이트, 다크/라이트 스위치(다크 #1A1A1A/#2D2D2D/#E0E0E0, 0.3초 전환), 반응형
6. 검증: 가짜 Supabase로 API 37개 검사 통과 + 헤드리스 Chrome으로 화면 43개 검사 통과, 라이트/다크/375px 캡처 확인. 입력한 HTML 태그는 글자 그대로 표시됨
7. `.gitignore` 점검: `.env.local`은 제외, `.env.example`은 커밋 가능
- 미확인: 진짜 Supabase 연결(사용자가 SQL 실행·`.env.local` 작성 필요), 사파리·실제 휴대폰
- 남은 일: 사용자 화면 확인 후 수정, README(배포 가이드), 진짜 DB 재검사(4b), Vercel 배포(사용자)
- 해석한 점: 요구사항 마지막 문장이 끊겨 정렬은 "날짜 최신순, 오래될수록 아래"로 구현

## 2026-11-08 — 히스토리 사이트 "공개 모드" 추가 (브랜치 `open-access`)

1. 요청: 배포한 사이트에 비밀번호 창이 떠서, 비밀번호 없이 쓰고 싶다고 함 (잠금 유지를 권했으나 사용자가 "완전 공개"를 선택)
2. `api/_lib.js` — `ADMIN_PASSWORD`가 **없으면 공개 모드**(누구나 읽기·쓰기), **있으면 잠금 모드**(기존 동작). 공개 모드에서는 같은 IP가 1분에 60번 넘게 쓰기(추가·삭제)하면 429로 막음
3. `js/app.js` — 시작할 때 먼저 그냥 열어 보고, 401일 때만 비밀번호 창을 띄움. 공개 모드에서는 "잠금" 버튼 숨김
4. `scripts/dev-server.js` — `ADMIN_PASSWORD`를 선택으로 변경, 시작 시 모드 표시. `.env.example`에 설명 추가
5. 검증: 잠금 모드 API 37·화면 43개(기존) 재통과, 공개 모드 화면 8·API 14개 통과
- 주의: Vercel에 `ADMIN_PASSWORD`가 이미 등록돼 있으면 계속 잠금 모드 → 공개로 바꾸려면 그 변수를 **삭제**하고 재배포해야 함
- 주의: 공개 모드는 누구나 기록을 지울 수 있음(사용자가 감수하기로 함). Supabase 무료 플랜은 자동 백업이 보장되지 않으므로 중요한 기록은 따로 보관 권장
- 미확인: 진짜 Supabase 연결, main 머지·push는 사용자 확인 대기

## 2026-11-08 — 어도비 히스토리 사이트 폐기 후 처음부터 다시 (사용자 요청)

1. 이유: 별도 Vercel 프로젝트 + 새 키(`SERVICE_ROLE`) 방식이 설정이 복잡해 배포에서 막힘. "포트폴리오 만든 것처럼" 하고 싶다는 요청
2. `adobe-history/` 폴더 전체 삭제(11개 파일), 작업 브랜치 `adobe-history`·`open-access` 삭제 (로컬 + GitHub)
3. 백업: 삭제 직전 상태를 태그 `backup-adobe-history-v1`(커밋 3a626ce)로 보존. 복구: `git checkout backup-adobe-history-v1 -- adobe-history`
4. 포트폴리오(`portfolio/`, `api/guestbook.js`)는 건드리지 않음
5. 새 방식: 기존 포트폴리오 Vercel 프로젝트 + 기존 환경변수(`SUPABASE_URL`, `SUPABASE_ANON_KEY`) 재사용, 주소는 `/history`
