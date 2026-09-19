do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'focus-gtd-weekly-reports';

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end;
$$;

drop function if exists public.generate_weekly_reports();
drop table if exists public.weekly_reports;
