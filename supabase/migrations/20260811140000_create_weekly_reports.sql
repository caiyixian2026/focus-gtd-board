create extension if not exists pg_cron;

create table if not exists public.weekly_reports (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  sections jsonb not null default '{"completed": [], "ongoing": [], "next": []}'::jsonb,
  generated_at timestamptz not null default timezone('utc'::text, now()),
  primary key (user_id, week_start)
);

alter table public.weekly_reports enable row level security;

revoke all on public.weekly_reports from anon;
grant select on public.weekly_reports to authenticated;

drop policy if exists "Users can read their own weekly reports" on public.weekly_reports;
create policy "Users can read their own weekly reports"
on public.weekly_reports for select
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.generate_weekly_reports()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  week_start date := date_trunc('week', timezone('Asia/Shanghai', now()))::date;
  next_week_start date := week_start + 7;
  following_week_start date := week_start + 14;
begin
  insert into public.weekly_reports (user_id, week_start, sections, generated_at)
  with all_tasks as (
    select user_boards.user_id, '任务安排'::text as project_name, task
    from public.user_boards
    cross join lateral jsonb_array_elements(coalesce(user_boards.board_data->'tasks', '[]'::jsonb)) as task
    union all
    select user_boards.user_id, '园区任务'::text as project_name, task
    from public.user_boards
    cross join lateral jsonb_array_elements(coalesce(user_boards.board_data->'parkTasks', '[]'::jsonb)) as task
    union all
    select user_boards.user_id, coalesce(project_meta.board->>'name', '项目任务') as project_name, task
    from public.user_boards
    cross join lateral jsonb_each(coalesce(user_boards.board_data->'projectTasks', '{}'::jsonb)) as custom_project
    cross join lateral jsonb_array_elements(custom_project.value) as task
    left join lateral (
      select project_board as board
      from jsonb_array_elements(coalesce(user_boards.board_data->'projectBoards', '[]'::jsonb)) as project_board
      where project_board->>'id' = custom_project.key
      limit 1
    ) as project_meta on true
  ), normalized as (
    select
      user_id,
      project_name,
      task->>'title' as title,
      coalesce(task->>'note', '') as note,
      nullif(task->>'due', '')::date as due_date,
      nullif(task->>'completedAt', '')::timestamptz as completed_at,
      nullif(task->>'updatedAt', '')::timestamptz as updated_at,
      coalesce((task->>'done')::boolean, false) as done,
      coalesce(task->>'quadrant', 'unassigned') as quadrant
    from all_tasks
  )
  select
    user_id,
    week_start,
    jsonb_build_object(
      'completed', coalesce(jsonb_agg(jsonb_build_object('project', project_name, 'title', title, 'note', note, 'due', due_date) order by project_name, title)
        filter (where done and timezone('Asia/Shanghai', completed_at)::date >= week_start and timezone('Asia/Shanghai', completed_at)::date < next_week_start), '[]'::jsonb),
      'ongoing', coalesce(jsonb_agg(jsonb_build_object('project', project_name, 'title', title, 'note', note, 'due', due_date) order by project_name, title)
        filter (where not done and (quadrant = 'in-progress' or (due_date >= week_start and due_date < next_week_start) or (timezone('Asia/Shanghai', updated_at)::date >= week_start and timezone('Asia/Shanghai', updated_at)::date < next_week_start))), '[]'::jsonb),
      'next', coalesce(jsonb_agg(jsonb_build_object('project', project_name, 'title', title, 'note', note, 'due', due_date) order by project_name, title)
        filter (where not done and due_date >= next_week_start and due_date < following_week_start), '[]'::jsonb)
    ),
    now()
  from normalized
  group by user_id
  on conflict (user_id, week_start) do update
  set sections = excluded.sections, generated_at = excluded.generated_at;
end;
$$;

do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'focus-gtd-weekly-reports';
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
  perform cron.schedule(
    'focus-gtd-weekly-reports',
    '0 6 * * 5',
    'select public.generate_weekly_reports();'
  );
end;
$$;
