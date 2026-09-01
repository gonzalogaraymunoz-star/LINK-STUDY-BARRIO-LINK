-- LINK STUDY v0.1 — additive study layer for LINK CONTROL CENTRAL
-- Applied to project zgbnjlrxzvzpigmwidsp on 2026-09-01.

create table if not exists public.study_studies (
  id uuid primary key default gen_random_uuid(),
  study_code text not null unique,
  control_id uuid not null references public.controls(id) on delete restrict,
  client_id uuid references public.clients(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  question text not null,
  study_type text not null default 'value_discovery' check (study_type in ('value_discovery','system_mapping','scenario','comparative','root_question')),
  question_level text not null default 'root' check (question_level in ('root','strategic','tactical')),
  status text not null default 'draft' check (status in ('draft','context_ready','running','completed','failed','archived')),
  source text not null default 'link-study',
  created_by text not null default 'human',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists study_studies_client_idx on public.study_studies(client_id, created_at desc);
create index if not exists study_studies_project_idx on public.study_studies(project_id, created_at desc);
create index if not exists study_studies_status_idx on public.study_studies(status, created_at desc);

create table if not exists public.study_snapshots (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.study_studies(id) on delete cascade,
  control_id uuid not null references public.controls(id) on delete restrict,
  client_id uuid references public.clients(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  snapshot_version integer not null default 1 check (snapshot_version > 0),
  context jsonb not null default '{}'::jsonb,
  coverage jsonb not null default '{}'::jsonb,
  source_counts jsonb not null default '{}'::jsonb,
  source_digest text,
  created_by text not null default 'system',
  created_at timestamptz not null default now(),
  unique(study_id, snapshot_version)
);

create index if not exists study_snapshots_study_idx on public.study_snapshots(study_id, created_at desc);

create table if not exists public.study_evidence (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.study_studies(id) on delete cascade,
  snapshot_id uuid references public.study_snapshots(id) on delete cascade,
  source_table text not null,
  source_id text,
  source_label text,
  fact jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists study_evidence_study_idx on public.study_evidence(study_id, created_at desc);
create index if not exists study_evidence_snapshot_idx on public.study_evidence(snapshot_id);

create table if not exists public.study_runs (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.study_studies(id) on delete cascade,
  snapshot_id uuid references public.study_snapshots(id) on delete set null,
  engine text not null check (engine in ('chatgpt','mirofish','manual','system')),
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled')),
  external_id text,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists study_runs_study_idx on public.study_runs(study_id, created_at desc);
create index if not exists study_runs_engine_idx on public.study_runs(engine, status);

create table if not exists public.study_findings (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.study_studies(id) on delete cascade,
  snapshot_id uuid references public.study_snapshots(id) on delete set null,
  run_id uuid references public.study_runs(id) on delete set null,
  truth_class text not null check (truth_class in ('fact','inference','hypothesis','simulation','proposal')),
  finding_type text not null default 'other' check (finding_type in ('value','friction','connection','risk','system','market','behavior','other')),
  title text not null,
  body text not null,
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  value_score numeric check (value_score is null or (value_score >= 0 and value_score <= 100)),
  evidence_refs jsonb not null default '[]'::jsonb,
  structured_data jsonb not null default '{}'::jsonb,
  actor text not null default 'unknown',
  created_at timestamptz not null default now()
);

create index if not exists study_findings_study_idx on public.study_findings(study_id, created_at desc);
create index if not exists study_findings_truth_idx on public.study_findings(truth_class, finding_type);

create table if not exists public.study_opportunities (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.study_studies(id) on delete cascade,
  snapshot_id uuid references public.study_snapshots(id) on delete set null,
  title text not null,
  description text,
  beneficiary text,
  counterparty text,
  value_type text,
  need_score smallint check (need_score is null or (need_score between 0 and 100)),
  recurrence_score smallint check (recurrence_score is null or (recurrence_score between 0 and 100)),
  pain_score smallint check (pain_score is null or (pain_score between 0 and 100)),
  market_score smallint check (market_score is null or (market_score between 0 and 100)),
  capture_score smallint check (capture_score is null or (capture_score between 0 and 100)),
  persistence_score smallint check (persistence_score is null or (persistence_score between 0 and 100)),
  execution_score smallint check (execution_score is null or (execution_score between 0 and 100)),
  friction_score smallint check (friction_score is null or (friction_score between 0 and 100)),
  opportunity_score numeric check (opportunity_score is null or (opportunity_score between 0 and 100)),
  evidence_refs jsonb not null default '[]'::jsonb,
  status text not null default 'proposed' check (status in ('proposed','validated','rejected','experimenting')),
  created_by text not null default 'unknown',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists study_opportunities_study_idx on public.study_opportunities(study_id, opportunity_score desc nulls last);

alter table public.study_studies enable row level security;
alter table public.study_snapshots enable row level security;
alter table public.study_evidence enable row level security;
alter table public.study_runs enable row level security;
alter table public.study_findings enable row level security;
alter table public.study_opportunities enable row level security;

create policy "study_members_select_studies" on public.study_studies for select to authenticated using (exists (select 1 from public.app_members m where m.user_id = auth.uid() and m.status = 'active'));
create policy "study_members_insert_studies" on public.study_studies for insert to authenticated with check (exists (select 1 from public.app_members m where m.user_id = auth.uid() and m.status = 'active'));
create policy "study_members_update_studies" on public.study_studies for update to authenticated using (exists (select 1 from public.app_members m where m.user_id = auth.uid() and m.status = 'active')) with check (exists (select 1 from public.app_members m where m.user_id = auth.uid() and m.status = 'active'));

create policy "study_members_select_snapshots" on public.study_snapshots for select to authenticated using (exists (select 1 from public.app_members m where m.user_id = auth.uid() and m.status = 'active'));
create policy "study_members_insert_snapshots" on public.study_snapshots for insert to authenticated with check (exists (select 1 from public.app_members m where m.user_id = auth.uid() and m.status = 'active'));
create policy "study_members_select_evidence" on public.study_evidence for select to authenticated using (exists (select 1 from public.app_members m where m.user_id = auth.uid() and m.status = 'active'));
create policy "study_members_insert_evidence" on public.study_evidence for insert to authenticated with check (exists (select 1 from public.app_members m where m.user_id = auth.uid() and m.status = 'active'));
create policy "study_members_select_runs" on public.study_runs for select to authenticated using (exists (select 1 from public.app_members m where m.user_id = auth.uid() and m.status = 'active'));
create policy "study_members_insert_runs" on public.study_runs for insert to authenticated with check (exists (select 1 from public.app_members m where m.user_id = auth.uid() and m.status = 'active'));
create policy "study_members_update_runs" on public.study_runs for update to authenticated using (exists (select 1 from public.app_members m where m.user_id = auth.uid() and m.status = 'active')) with check (exists (select 1 from public.app_members m where m.user_id = auth.uid() and m.status = 'active'));
create policy "study_members_select_findings" on public.study_findings for select to authenticated using (exists (select 1 from public.app_members m where m.user_id = auth.uid() and m.status = 'active'));
create policy "study_members_insert_findings" on public.study_findings for insert to authenticated with check (exists (select 1 from public.app_members m where m.user_id = auth.uid() and m.status = 'active'));
create policy "study_members_select_opportunities" on public.study_opportunities for select to authenticated using (exists (select 1 from public.app_members m where m.user_id = auth.uid() and m.status = 'active'));
create policy "study_members_insert_opportunities" on public.study_opportunities for insert to authenticated with check (exists (select 1 from public.app_members m where m.user_id = auth.uid() and m.status = 'active'));
create policy "study_members_update_opportunities" on public.study_opportunities for update to authenticated using (exists (select 1 from public.app_members m where m.user_id = auth.uid() and m.status = 'active')) with check (exists (select 1 from public.app_members m where m.user_id = auth.uid() and m.status = 'active'));
