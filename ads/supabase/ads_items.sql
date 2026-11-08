-- ============================================================
-- 어도비 페이지 공유 저장소 · Supabase (Postgres) · 테이블 이름: ads_items
-- 사용법: Supabase 대시보드 → SQL Editor → New query 에
--         이 파일을 통째로 붙여넣고 Run (여러 번 실행해도 안전)
-- 구조: 항목 하나(캠페인·히스토리·소재·일정·업무) = 1행. 여러 사람이 동시에 고쳐도 서로 다른 항목은 안 덮어써요.
-- 정책: 누구나 읽기·쓰기 가능(로그인 없는 공개 방식). 삭제는 행을 지우지 않고 deleted=true 표시만 해요.
--       ※ 고객명·금액 같은 민감한 정보는 적지 마세요
-- ============================================================

-- 1) 테이블 ------------------------------------------------
create table if not exists public.ads_items (
  collection  text        not null,
  id          text        not null,
  data        jsonb       not null,                  -- 항목 내용(JSON)
  deleted     boolean     not null default false,    -- true = 삭제됨 (되살리려면 false 로 바꾸면 됨)
  updated_at  timestamptz not null default now(),    -- 서버가 자동 기록 (다른 사람 변경을 받아 오는 기준)

  primary key (collection, id),
  constraint ads_items_collection_ok check (collection in ('campaigns','histories','creatives','schedules','tasks')),
  constraint ads_items_id_ok         check (id ~ '^[A-Za-z0-9_-]{1,64}$'),
  constraint ads_items_size_ok       check (pg_column_size(data) <= 30000)
);

comment on table public.ads_items is '어도비 페이지 공유 데이터 (항목 1개 = 1행)';

create index if not exists ads_items_updated_idx on public.ads_items (updated_at);

-- 2) 바뀐 시각은 서버가 직접 기록 (브라우저가 값을 속일 수 없게) ----
create or replace function public.ads_items_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists ads_items_touch on public.ads_items;
create trigger ads_items_touch
  before insert or update on public.ads_items
  for each row execute function public.ads_items_touch();

-- 3) RLS(행 단위 보안) 켜기 + 정책 ------------------------------
alter table public.ads_items enable row level security;

drop policy if exists "ads_items_select_public" on public.ads_items;
drop policy if exists "ads_items_insert_public" on public.ads_items;
drop policy if exists "ads_items_update_public" on public.ads_items;

create policy "ads_items_select_public" on public.ads_items
  for select to anon, authenticated using (true);
create policy "ads_items_insert_public" on public.ads_items
  for insert to anon, authenticated with check (true);
create policy "ads_items_update_public" on public.ads_items
  for update to anon, authenticated using (true) with check (true);
-- DELETE 정책은 일부러 없음 → 행은 지워지지 않고 deleted 표시만 됨

-- 4) 권한(grant) — RLS 와 이중 잠금 ---------------------------
revoke all on public.ads_items from anon, authenticated;
grant select on public.ads_items to anon, authenticated;
grant insert (collection, id, data, deleted) on public.ads_items to anon, authenticated;
grant update (collection, id, data, deleted) on public.ads_items to anon, authenticated;

-- ============================================================
-- 실수로 지운 항목을 되살리고 싶을 때:
--   Table Editor → ads_items → 해당 행의 deleted 를 false 로 바꾸기
--   (또는 SQL: update public.ads_items set deleted = false where collection = 'tasks' and id = '...';)
-- ※ 서버(Vercel 함수)에는 anon(공개) 키만 사용. service_role 키는 절대 넣지 말 것
-- ============================================================
