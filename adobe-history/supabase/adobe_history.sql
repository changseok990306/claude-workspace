-- 어도비 캠페인 히스토리 — Supabase 스키마
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 안전합니다.

-- 1) 캠페인
create table if not exists public.campaigns (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 40),
  color      text not null default 'indigo'
             check (color in ('indigo','teal','amber','rose','green','violet','orange','slate')),
  created_at timestamptz not null default now()
);

-- 2) 히스토리 (캠페인이 삭제되면 함께 삭제)
create table if not exists public.histories (
  id          bigint generated always as identity primary key,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  content     text not null check (char_length(content) between 1 and 1000),
  event_date  date not null,
  created_at  timestamptz not null default now()
);

-- 3) 정렬·조회용 인덱스 (최신 날짜순)
create index if not exists histories_date_idx
  on public.histories (event_date desc, created_at desc);
create index if not exists histories_campaign_idx
  on public.histories (campaign_id);

-- 4) 보안: RLS 켜고 공개 정책은 만들지 않음
--    → 브라우저용 공개 키(anon)로는 읽기/쓰기 모두 불가.
--    → 서버 함수가 service_role 키로만 접근합니다. (이 키는 절대 브라우저/코드에 넣지 마세요)
alter table public.campaigns enable row level security;
alter table public.histories enable row level security;

revoke all on public.campaigns from anon, authenticated;
revoke all on public.histories from anon, authenticated;

-- 5) 예시 캠페인 4개 (테이블이 비어 있을 때만 1회 추가 — 앱에서 자유롭게 수정/삭제 가능)
insert into public.campaigns (name, color)
select v.name, v.color
from (values
  ('브랜드 런칭',   'indigo'),
  ('여름 프로모션', 'orange'),
  ('리타게팅',      'teal'),
  ('신규 가입 이벤트', 'rose')
) as v(name, color)
where not exists (select 1 from public.campaigns);
