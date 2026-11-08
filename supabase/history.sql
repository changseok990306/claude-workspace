-- ============================================================
-- 어도비 캠페인 히스토리 스키마 · Supabase (Postgres)
-- 테이블: campaigns(캠페인), histories(히스토리)
-- 사용법: Supabase 대시보드 → SQL Editor → New query 에
--         이 파일을 통째로 붙여넣고 Run (여러 번 실행해도 안전)
-- 정책: 누구나 읽기·추가·삭제 가능 (로그인 없는 공개 방식 — messages.sql 과 같은 방식)
--       ※ 민감한 업무 정보(고객명·금액 등)는 적지 마세요
-- ============================================================

-- 1) 캠페인 ------------------------------------------------
create table if not exists public.campaigns (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  color       text        not null default 'indigo',
  created_at  timestamptz not null default now(),

  constraint campaigns_name_len check (char_length(btrim(name)) between 1 and 40),
  constraint campaigns_color_ok check (color in
    ('indigo','teal','amber','rose','green','violet','orange','slate'))
);

-- 2) 히스토리 (캠페인을 지우면 그 캠페인의 히스토리도 함께 지워짐) ---
create table if not exists public.histories (
  id           bigint      generated always as identity primary key,
  campaign_id  uuid        not null references public.campaigns(id) on delete cascade,
  content      text        not null,
  event_date   date        not null,                 -- 사용자가 입력하는 "히스토리 날짜"
  created_at   timestamptz not null default now(),   -- 서버가 자동 기록

  constraint histories_content_len check (char_length(btrim(content)) between 1 and 1000)
);

comment on table public.campaigns is '어도비 캠페인';
comment on table public.histories is '캠페인별 히스토리';

-- 3) 조회용 인덱스 (날짜 최신순 정렬, 캠페인별 필터) ----------------
create index if not exists histories_date_idx
  on public.histories (event_date desc, created_at desc);
create index if not exists histories_campaign_idx
  on public.histories (campaign_id);

-- 4) RLS(행 단위 보안) 켜기 -----------------------------------
alter table public.campaigns enable row level security;
alter table public.histories enable row level security;

-- 5) 정책 (다시 실행해도 에러 나지 않게 먼저 지우고 만듦) ----------
drop policy if exists "campaigns_select_public" on public.campaigns;
drop policy if exists "campaigns_insert_public" on public.campaigns;
drop policy if exists "campaigns_update_public" on public.campaigns;
drop policy if exists "campaigns_delete_public" on public.campaigns;
drop policy if exists "histories_select_public" on public.histories;
drop policy if exists "histories_insert_public" on public.histories;
drop policy if exists "histories_delete_public" on public.histories;

create policy "campaigns_select_public" on public.campaigns
  for select to anon, authenticated using (true);
create policy "campaigns_insert_public" on public.campaigns
  for insert to anon, authenticated with check (true);
create policy "campaigns_update_public" on public.campaigns
  for update to anon, authenticated using (true) with check (true);
create policy "campaigns_delete_public" on public.campaigns
  for delete to anon, authenticated using (true);

create policy "histories_select_public" on public.histories
  for select to anon, authenticated using (true);
create policy "histories_insert_public" on public.histories
  for insert to anon, authenticated with check (true);
create policy "histories_delete_public" on public.histories
  for delete to anon, authenticated using (true);
-- histories 의 UPDATE 정책은 일부러 없음 (히스토리 수정은 지원하지 않음)

-- 6) 권한(grant) — RLS 와 이중 잠금 ---------------------------
revoke all on public.campaigns from anon, authenticated;
revoke all on public.histories from anon, authenticated;

grant select, delete on public.campaigns to anon, authenticated;
grant select, delete on public.histories to anon, authenticated;

-- 입력·수정 가능한 칸만 열어 둠 (id, created_at 을 마음대로 조작하는 것을 막음)
grant insert (name, color) on public.campaigns to anon, authenticated;
grant update (name, color) on public.campaigns to anon, authenticated;
grant insert (campaign_id, content, event_date) on public.histories to anon, authenticated;

-- ============================================================
-- 전체 초기화가 필요하면(되돌릴 수 없음!):
--   Table Editor 에서 campaigns 행을 지우면 histories 도 함께 지워집니다.
-- ※ 프론트엔드/서버에는 anon(공개) 키만 사용. service_role 키는 절대 넣지 말 것
-- ============================================================
