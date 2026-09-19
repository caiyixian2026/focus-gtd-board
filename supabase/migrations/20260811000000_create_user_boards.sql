create table if not exists public.user_boards (
  user_id uuid primary key references auth.users(id) on delete cascade,
  board_data jsonb not null default '{"events": [], "tasks": []}'::jsonb,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.user_boards enable row level security;

revoke all on public.user_boards from anon;
grant select, insert, update, delete on public.user_boards to authenticated;

drop policy if exists "Users can read their own board" on public.user_boards;
create policy "Users can read their own board"
on public.user_boards for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own board" on public.user_boards;
create policy "Users can create their own board"
on public.user_boards for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own board" on public.user_boards;
create policy "Users can update their own board"
on public.user_boards for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own board" on public.user_boards;
create policy "Users can delete their own board"
on public.user_boards for delete
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists set_user_boards_updated_at on public.user_boards;
create trigger set_user_boards_updated_at
before update on public.user_boards
for each row execute function public.set_updated_at();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_boards'
  ) then
    alter publication supabase_realtime add table public.user_boards;
  end if;
end $$;
