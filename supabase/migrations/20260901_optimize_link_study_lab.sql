create index if not exists study_studies_control_idx on public.study_studies(control_id, created_at desc);
create index if not exists study_snapshots_control_idx on public.study_snapshots(control_id, created_at desc);
create index if not exists study_snapshots_client_idx on public.study_snapshots(client_id, created_at desc) where client_id is not null;
create index if not exists study_snapshots_project_idx on public.study_snapshots(project_id, created_at desc) where project_id is not null;
create index if not exists study_runs_snapshot_idx on public.study_runs(snapshot_id) where snapshot_id is not null;
create index if not exists study_findings_snapshot_idx on public.study_findings(snapshot_id) where snapshot_id is not null;
create index if not exists study_findings_run_idx on public.study_findings(run_id) where run_id is not null;
create index if not exists study_opportunities_snapshot_idx on public.study_opportunities(snapshot_id) where snapshot_id is not null;

drop policy if exists "study_members_select_studies" on public.study_studies;
drop policy if exists "study_members_insert_studies" on public.study_studies;
drop policy if exists "study_members_update_studies" on public.study_studies;
drop policy if exists "study_members_select_snapshots" on public.study_snapshots;
drop policy if exists "study_members_insert_snapshots" on public.study_snapshots;
drop policy if exists "study_members_select_evidence" on public.study_evidence;
drop policy if exists "study_members_insert_evidence" on public.study_evidence;
drop policy if exists "study_members_select_runs" on public.study_runs;
drop policy if exists "study_members_insert_runs" on public.study_runs;
drop policy if exists "study_members_update_runs" on public.study_runs;
drop policy if exists "study_members_select_findings" on public.study_findings;
drop policy if exists "study_members_insert_findings" on public.study_findings;
drop policy if exists "study_members_select_opportunities" on public.study_opportunities;
drop policy if exists "study_members_insert_opportunities" on public.study_opportunities;
drop policy if exists "study_members_update_opportunities" on public.study_opportunities;

create policy "study_owner_select_studies" on public.study_studies for select to authenticated using (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.status = 'active' and m.role = 'owner'));
create policy "study_owner_insert_studies" on public.study_studies for insert to authenticated with check (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.status = 'active' and m.role = 'owner'));
create policy "study_owner_update_studies" on public.study_studies for update to authenticated using (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.status = 'active' and m.role = 'owner')) with check (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.status = 'active' and m.role = 'owner'));

create policy "study_owner_select_snapshots" on public.study_snapshots for select to authenticated using (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.status = 'active' and m.role = 'owner'));
create policy "study_owner_insert_snapshots" on public.study_snapshots for insert to authenticated with check (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.status = 'active' and m.role = 'owner'));

create policy "study_owner_select_evidence" on public.study_evidence for select to authenticated using (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.status = 'active' and m.role = 'owner'));
create policy "study_owner_insert_evidence" on public.study_evidence for insert to authenticated with check (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.status = 'active' and m.role = 'owner'));

create policy "study_owner_select_runs" on public.study_runs for select to authenticated using (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.status = 'active' and m.role = 'owner'));
create policy "study_owner_insert_runs" on public.study_runs for insert to authenticated with check (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.status = 'active' and m.role = 'owner'));
create policy "study_owner_update_runs" on public.study_runs for update to authenticated using (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.status = 'active' and m.role = 'owner')) with check (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.status = 'active' and m.role = 'owner'));

create policy "study_owner_select_findings" on public.study_findings for select to authenticated using (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.status = 'active' and m.role = 'owner'));
create policy "study_owner_insert_findings" on public.study_findings for insert to authenticated with check (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.status = 'active' and m.role = 'owner'));

create policy "study_owner_select_opportunities" on public.study_opportunities for select to authenticated using (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.status = 'active' and m.role = 'owner'));
create policy "study_owner_insert_opportunities" on public.study_opportunities for insert to authenticated with check (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.status = 'active' and m.role = 'owner'));
create policy "study_owner_update_opportunities" on public.study_opportunities for update to authenticated using (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.status = 'active' and m.role = 'owner')) with check (exists (select 1 from public.app_members m where m.user_id = (select auth.uid()) and m.status = 'active' and m.role = 'owner'));
