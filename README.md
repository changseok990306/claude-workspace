# 🗂️ claude-workspace

오창석의 Claude Code 작업 공간입니다.
Claude Code가 일할 때 따르는 규칙, 할 일, 작업 기록, 보안 매뉴얼을 한곳에 모아둡니다.

---

## 📁 폴더 구조

```
claude-workspace/
├── CLAUDE.md          📜 Claude Code 지침서 (규칙·소통 방식·작업 원칙)
├── README.md          📖 지금 보고 있는 파일 — 폴더 안내
├── SECURITY.md        🚨 키 노출 시 비상 매뉴얼
├── .gitignore         🙈 git에 올리지 않을 파일 목록
├── vercel.json        ▲ Vercel 배포 설정 (portfolio/ 폴더만 공개)
├── .env.example       📝 필요한 환경변수 이름 목록 (값 없음)
├── api/
│   ├── guestbook.js   💬 방명록 서버 함수 (Vercel)
│   ├── campaigns.js   📚 캠페인 서버 함수 (히스토리 사이트)
│   ├── histories.js   📚 히스토리 서버 함수 (히스토리 사이트)
│   └── _lib.js        🔧 위 두 함수의 공통 도우미 (밑줄 파일은 주소로 공개 안 됨)
├── supabase/
│   ├── messages.sql   🗄️ 방명록 DB 스키마 + 보안 정책
│   └── history.sql    🗄️ 캠페인 히스토리 DB 스키마 + 보안 정책
├── scripts/
│   └── dev-server.js  🧪 로컬 테스트용 서버 (포트폴리오 + 방명록 + 히스토리)
├── .env.local         🔒 로컬 테스트용 키 (내 컴퓨터에만 · GitHub에는 없음)
├── .env               🔒 API 키 보관 (로컬에만 존재 · GitHub에는 없음)
├── tasks/
│   ├── todo.md        ✅ 오늘 할 일 (체크리스트)
│   └── progress.md    📒 한 일 기록 (추가만 하고 지우지 않음)
├── docs/
│   ├── sample_sales.csv         📊 샘플 매출 데이터
│   └── adobe-history-PRD.md     📋 어도비 캠페인 히스토리 기획서(PRD)
└── portfolio/
    ├── index.html     🌐 포트폴리오 웹페이지
    └── history/       📚 어도비 캠페인 히스토리 사이트 (주소: /history)
        ├── index.html · style.css · app.js · api.js
```

> 🙈 `docs/resume.pdf`, `tasks/move-log.csv`는 개인·거래처 정보가 있어 로컬에만 두고 GitHub에는 올리지 않아요.

**작업 폴더 밖에 있는 것**

```
~/.ssh/
├── oracle-server.key  🔑 오라클 서버 SSH 키 (절대 공유 금지)
└── config             ⚙️ SSH 설정 — 별칭 `oracle-server` 등록
```

---

## 📄 파일별 역할

| 파일 | 언제 보나요? | 누가 쓰나요? |
|---|---|---|
| `CLAUDE.md` | Claude Code가 작업 시작할 때 자동으로 읽음 | 내가 직접 수정 |
| `tasks/todo.md` | 작업 **시작** 전에 확인 | Claude Code + 나 |
| `tasks/progress.md` | 작업 **끝날** 때 기록 | Claude Code |
| `SECURITY.md` | 키가 노출된 것 같을 때 | 비상시 참고 |
| `.env` | 프로그램이 키를 읽을 때 | 나만 (절대 공유 X) |
| `docs/` | 참고 자료·샘플 데이터가 필요할 때 | 나 |
| `portfolio/index.html` | 포트폴리오 페이지를 볼 때 (브라우저로 열기) | 나 + Claude Code |

---

## 🚀 포트폴리오 배포 (Vercel)

`vercel.json`이 설정돼 있어서 `portfolio/` 폴더만 웹에 공개돼요. (`CLAUDE.md`, `SECURITY.md`, `tasks/` 등은 공개되지 않음)

1. [vercel.com](https://vercel.com) 로그인 → **Add New… → Project**
2. GitHub의 `claude-workspace` 레포 선택 → **Import**
3. 설정은 건드리지 않고 **Deploy** (Framework Preset은 `Other`, 나머지는 `vercel.json`이 알아서 적용)
4. 이후엔 `main`에 push할 때마다 **자동으로 다시 배포**돼요.

> ⚠️ 배포 전에 `portfolio/index.html`의 노란색 `[ ]` 자리를 채우세요. 안 채우면 그대로 공개돼요.

### 💬 방명록 설정 (Supabase)

방명록은 `브라우저 → api/guestbook.js (Vercel 함수) → Supabase` 순서로 동작해요. 키는 코드가 아니라 Vercel 환경변수에만 둡니다.

1. [supabase.com](https://supabase.com)에서 프로젝트 만들기
2. **SQL Editor → New query**에 `supabase/messages.sql` 내용을 붙여넣고 **Run** (`messages` 테이블 + 읽기/쓰기 정책이 만들어져요)
3. **Project Settings → API**에서 `Project URL`과 `anon public` 키 복사 (⚠️ `service_role` 키는 복사 금지)
4. Vercel 프로젝트 → **Settings → Environment Variables**에 등록 (이름은 `.env.example` 참고)
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
5. **Redeploy** (환경변수는 재배포해야 적용돼요)

> 방명록 글을 지우고 싶으면 Supabase **Table Editor** → `messages` → 해당 행을 삭제하세요. (방문자는 수정·삭제 불가)

### 📚 어도비 캠페인 히스토리 (`/history`)

캠페인별로 날짜와 함께 히스토리를 기록하고 검색하는 페이지예요. 기획 내용은 `docs/adobe-history-PRD.md`를 보세요.
방명록과 **같은 Vercel 프로젝트, 같은 환경변수**를 쓰므로 새로 만들 것이 없어요.

1. Supabase **SQL Editor → New query**에 `supabase/history.sql` 내용을 붙여넣고 **Run**
   (`campaigns`, `histories` 두 테이블과 정책이 만들어져요. 여러 번 실행해도 안전)
2. 코드를 `main`에 push → Vercel이 **자동으로 다시 배포** (환경변수 `SUPABASE_URL`, `SUPABASE_ANON_KEY`는 방명록 때 넣은 그대로)
3. `내포트폴리오주소/history` 접속 → **+ 새 캠페인**으로 캠페인을 만들고 히스토리를 기록

> ⚠️ **로그인이 없는 공개 페이지**예요. 주소를 아는 사람은 누구나 기록을 보고·추가하고·지울 수 있어요.
> 고객명·금액 같은 민감한 업무 정보는 적지 마세요. 포트폴리오에는 링크를 걸지 않았고 검색엔진에도 안 잡히게(`noindex`) 해 뒀어요.
> Supabase 무료 플랜은 자동 백업이 보장되지 않으니 중요한 기록은 따로 복사해 두세요.
>
> 화면에 **"기록을 불러오지 못했어요"** 가 뜨면 → 1번(SQL 실행)을 먼저 했는지, Vercel 환경변수 두 개가 있는지 확인하세요.

### 🧪 로컬에서 테스트하기

Vercel에 올리기 전에 내 컴퓨터에서 먼저 확인할 수 있어요.

1. 프로젝트 폴더에 `.env.local` 파일을 만들고 아래 두 줄을 채워요. (`.env.example` 참고 · 이 파일은 git에 안 올라가요)
   ```
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_ANON_KEY=여기에_anon_공개키
   ```
2. 터미널에서 실행 (Node.js 20.6 이상 필요)
   ```
   node --env-file=.env.local scripts/dev-server.js
   ```
3. 브라우저에서 **http://localhost:3000** 열기 → 맨 아래 방명록에서 글 남겨 보기
   (히스토리 사이트는 **http://localhost:3000/history** — 먼저 `history.sql`을 Supabase에서 실행해 두세요)
4. 끄려면 터미널에서 `Ctrl + C`

> 목록이 "불러오지 못했어요"로 나오면, 터미널에 찍히는 `[guestbook] Supabase 응답 …` 줄이 원인이에요.
> `Could not find the table` → 아직 2번(SQL 실행)을 안 한 거예요.

---

## 🔄 하루 작업 흐름

1. **시작** → `tasks/todo.md` 확인
2. **계획** → 3단계 이상 걸리는 일은 `todo.md`에 계획부터 쓰고 OK 받기
3. **실행** → 한 단계씩, 확인하면서
4. **확인** → 실제로 돌려보고 결과 보기
5. **기록** → `tasks/progress.md`에 한 일 추가

---

## 🔒 보안 한눈에 보기

- 키는 **`.env`에만**, 코드에 직접 쓰지 않기
- `.env` · `*.key` · `*.pem` · `id_rsa` · `credentials` → **git에 올리지 않기**
- 키 노출 의심 → **`SECURITY.md`** 열고 "② 폐기"부터

---

*마지막 정리: 2026-11-01*
