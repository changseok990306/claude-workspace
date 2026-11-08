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

## 2026-11-08 — 오늘 한 어도비 히스토리 작업 전부 삭제 (사용자 요청)

1. 사유: Vercel 프로젝트 삭제로 사이트가 내려가 혼선이 생겨, 오늘 작업을 모두 지우고 처음부터 다시 하기로 함
2. 범위: 2026-11-08에 한 작업만. 11월 1일 마지막 커밋(`cf18ad2`, 방명록 머지) 상태로 되돌림 — 포트폴리오·방명록·`CLAUDE.md`·`SECURITY.md`는 그대로
3. 백업: 태그 `backup-before-reset-20261108`(삭제 직전 전체), `backup-adobe-history-v1`(v1 폴더). 복구 예: `git checkout backup-before-reset-20261108 -- portfolio/history api supabase/history.sql docs/adobe-history-PRD.md`
4. 이 메모를 빼고 나머지 오늘 기록(`todo.md`·`progress.md`의 11월 8일 항목)은 되돌리기와 함께 사라짐 — 백업 태그에 남아 있음

## 2026-11-08 — 광고 운영 웹페이지 v3 (브랜치 `ads-page`, 폴더 `ads/`)

1. 요청: 광고 운영 웹페이지. 기록장·성과·예산/일정·소재 4기능, 데이터는 직접 입력 + CSV 업로드, 다크모드, "배포는 지금 생각하지 말고" → 서버·DB 없는 순수 HTML/CSS/JS, 데이터는 브라우저(localStorage)에 저장
2. `ads/` 구성: `index.html`, `css/`(style·ads), `js/`(calc·csv·store·sample·ui·charts·records·performance·budget·creatives·data·app), `README.md`
3. 기능: 캠페인(8색 추가/수정/삭제, 연쇄 삭제) · 기록장(날짜 최신순, 실시간 검색) · 성과(지표 카드 7종, 기간 필터, 캠페인별 추이 차트, 표, 직접 입력/덮어쓰기, CSV) · 예산·일정(소진율·잔액·속도 경고·간트, 성과 비용 자동 연동) · 소재(상태 3열 보드, 점검 체크리스트) · 데이터 창(CSV 가져오기 미리보기, 내보내기, JSON 백업/복원, 예시 데이터, 전체 삭제)
4. 설계 포인트: 저장을 `store.js` 한 파일로 분리(나중에 DB 교체 가능), CSV 수식 주입 방지(= + - @ 앞에 ' → 가져올 때 복원), 입력 글은 textContent 로만 출력, 저장 실패 시 경고
5. 검증(헤드리스 Chrome + Node): 단위 141 · 저장소 70 · 화면 뼈대/기록장 44 · 성과 45 · 예산/소재 62 · 데이터 창 40 · file:// 직접 열기 6 = 408개 통과. 화면 합계가 데이터에서 직접 계산한 값과 일치함을 확인
6. 검증 중 고친 것: 차트가 입력 없는 날을 0원으로 그리던 문제 → 끊긴 선으로 변경 / 입력 카드 버튼 색이 캠페인 색을 안 따르던 문제 / 파비콘 404 / CSV 내보내기→가져오기 왕복 시 ' 가 남던 문제
- 미확인: 사파리·실제 휴대폰, 사용자의 실제 CSV 파일 모양(엑셀 저장 방식에 따라 다를 수 있음), 브라우저 저장 용량 한계(5MB 안팎) 근처 동작
- 한계: 데이터는 이 브라우저에만 저장(다른 기기·보는 사람과 공유 안 됨). "누구나 비밀번호 없이 보기"는 배포 + DB 연결이 필요 → 별도 단계
