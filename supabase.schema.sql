-- aqua-app 云同步表结构 + 行级安全策略(RLS)。
-- 用法:Supabase 项目 → SQL Editor → 新建 query → 粘贴全部 → Run。
--
-- 设计:每个用户一行,整份 Tank[] 存在 data(JSONB)里。前端拿的是公开 anon key,
-- 真正拦住"别人读你的数据"的是下面的 RLS 策略 —— 每条策略都要求 auth.uid() = user_id。

create table if not exists public.tank_data (
    user_id    uuid primary key references auth.users (id) on delete cascade,
    data       jsonb not null default '[]'::jsonb,
    updated_at timestamptz not null default now()
);

-- 开启 RLS 后,默认拒绝一切访问,只有下面的策略放行的才通过。
alter table public.tank_data enable row level security;

-- 只能读自己的行
create policy "read own tank_data"
    on public.tank_data for select
    using (auth.uid() = user_id);

-- 只能插入 user_id = 自己 的行
create policy "insert own tank_data"
    on public.tank_data for insert
    with check (auth.uid() = user_id);

-- 只能改自己的行
create policy "update own tank_data"
    on public.tank_data for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
