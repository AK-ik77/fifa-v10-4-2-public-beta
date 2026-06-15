-- 参考：如果前端无法读取 matches 表，检查 RLS 只读策略。
-- 仅供参考。不要把 service_role key 放进前端。

-- alter table matches enable row level security;

-- create policy "public read matches"
-- on matches
-- for select
-- to anon
-- using (true);
