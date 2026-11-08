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
│   └── guestbook.js   💬 방명록 서버 함수 (Vercel)
├── supabase/
│   └── messages.sql   🗄️ 방명록 DB 스키마 + 보안 정책
├── scripts/
│   └── dev-server.js  🧪 로컬 테스트용 서버 (포트폴리오 + 방명록)
├── .env.local         🔒 로컬 테스트용 키 (내 컴퓨터에만 · GitHub에는 없음)
├── .env               🔒 API 키 보관 (로컬에만 존재 · GitHub에는 없음)
├── tasks/
│   ├── todo.md        ✅ 오늘 할 일 (체크리스트)
│   └── progress.md    📒 한 일 기록 (추가만 하고 지우지 않음)
├── docs/
│   └── sample_sales.csv   📊 샘플 매출 데이터
└── portfolio/
    └── index.html     🌐 포트폴리오 웹페이지
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
