# Backend status — 2026-09-01

Target data plane: existing LINK CONTROL CENTRAL Supabase project.

Applied migrations:

- `add_link_study_lab`
- `optimize_link_study_lab`

Created isolated persistence:

- `study_studies`
- `study_snapshots`
- `study_evidence`
- `study_runs`
- `study_findings`
- `study_opportunities`

Operational Control Central tables were not deleted or rewritten by these migrations.

Direct authenticated RLS access to `study_*` is restricted to an active `app_members.role = 'owner'`. The web app and MCP use server-side service-role access and never expose the key to the browser.
