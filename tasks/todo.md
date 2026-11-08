# ✅ 오늘 할 일 (todo)

> 작업을 시작할 때 이 파일을 먼저 확인합니다.
> 끝난 항목은 `[x]`로 체크하고, 완료 내용은 `progress.md`에 기록합니다.

---

## 2026-11-01 — 포트폴리오 방명록 붙이기 (진행 중 — 머지·배포만 남음)

방식: 브라우저 → **Vercel 함수(`api/guestbook.js`)** → Supabase. 키는 Vercel 환경변수에만 보관 (코드에 하드코딩 X)

- [x] 0a. Supabase 프로젝트 생성, URL·anon 키 `.env.local`에 저장
- [ ] 0b. (직접) SQL Editor에서 `supabase/messages.sql` 실행 → `messages` 테이블 생성
- [x] 1. 새 브랜치 `guestbook`
- [x] 2. `api/guestbook.js` 작성 — GET(목록) / POST(작성), 입력 검증·간단한 도배 방지
- [x] 3. `portfolio/index.html`에 방명록 섹션(입력창+목록) 추가 — 남색 테마 유지, `textContent`로 출력
- [x] 4. `.env.example` 추가 (키 이름만, 값 없음) + README에 환경변수 설정법
- [x] 5. 가짜 Supabase로 함수 동작 테스트 + 화면 캡처 확인
- [ ] 6. 커밋 → (OK 받으면) main 머지 + push
- [ ] 7. (직접) Vercel 환경변수 `SUPABASE_URL`, `SUPABASE_ANON_KEY` 등록 후 재배포

## 2026-11-01 — 강남구 날씨·미세먼지 자동 저장 (보류 — 사용자 요청으로 중단)

- [ ] 1. `scripts/get-weather.ps1` 작성 (Open-Meteo, API 키 없음)
- [ ] 2. 직접 한 번 실행해서 `weather.txt` 내용 확인
- [ ] 3. 윈도우 작업 스케줄러에 "매일 09:00" 등록 (`ClaudeWeather`)
- [ ] 4. 등록 확인 + `progress.md`에 기록

## 2026-11-01 — 다운로드 폴더 정리 (완료)

- [x] 1. 이동 목록(`move-log.csv`) 먼저 만들어서 확인
- [x] 2. `Downloads\images`, `docs`, `misc` 폴더 생성
- [x] 3. 최상위 파일 539개 이동 (이름 겹치면 덮어쓰지 않고 `_1` 붙임)
- [x] 4. 개수 맞는지 검증 후 `progress.md`에 기록

## 2026-11-01 — 작업 환경 구축

- [x] 1. `tasks/` 폴더 + `todo.md`, `progress.md` 생성
- [x] 2. `SECURITY.md` 비상 매뉴얼 작성
- [x] 3. 폴더 구조를 `README.md`로 정리

### 다음에 할 일 (직접 채우기)

- [ ] `.env` 파일 만들기 (API 키 보관용 — 절대 공유 금지)
- [ ] `~/.ssh/oracle-server.key` 위치 확인
- [ ] `SECURITY.md`의 "내 키 목록" 표 채우기

---

<!-- 새 날짜는 위쪽에 추가하세요 -->

