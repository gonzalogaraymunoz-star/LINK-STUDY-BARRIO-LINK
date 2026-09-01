# LINK STUDY

LINK STUDY is the consultative study machine for the LINK ecosystem. It is intentionally separate from LINK CONTROL CENTRAL.

## Core rule

**Reality feeds the study. The study never alters reality automatically.**

The app reads live business context from the existing LINK CONTROL CENTRAL Supabase project and writes only to isolated `study_*` tables. Findings are explicitly classified as:

- `fact`
- `inference`
- `hypothesis`
- `simulation`
- `proposal`

MiroFish outputs are always stored as `simulation` context, never as operational truth.

## Architecture

```text
ChatGPT
   │ MCP
   ▼
LINK STUDY ───────────────► MiroFish (optional engine)
   │                            │
   │ reads                      │ simulation
   ▼                            ▼
LINK CONTROL CENTRAL        study_runs
Supabase                        │
   │                            ▼
   └──────── facts ───────► study_findings / opportunities
```

LINK STUDY reuses the verified engineering pattern from LINK CONTROL CENTRAL:

- Next.js 16 / React 19 / TypeScript
- Supabase service-role only on the server
- Gateway-style auditing into `events`
- MCP endpoint for ChatGPT
- GitHub as source of truth
- Vercel deploy
- **No Fake UI**: actions are hidden or disabled when their backend is unavailable.

## What works in v0.1

1. Reads real controls, clients and projects from LINK CONTROL CENTRAL.
2. Creates persistent studies in `study_studies`.
3. Builds immutable context snapshots from live business data.
4. Stores evidence with provenance.
5. Stores findings with truth classification.
6. Stores measurable value opportunities with a transparent score.
7. Audits relevant mutations into Control Central `events`.
8. Exposes MCP tools for ChatGPT.
9. Detects a configured MiroFish server and can seed a real MiroFish graph-building run.
10. Keeps the MiroFish run state in Supabase so polling/synchronization can continue across serverless requests.

## Context sources

A snapshot can include, when present:

- `clients`
- `client_profiles`
- `client_strategies` / `client_plan_assignments` / `service_plans`
- `client_gestures`
- `client_cycles`
- `needs`
- `work_items`
- `projects`
- `project_briefs` / `project_integrations`
- `requests`, `commitments`, `deliverables`, `assets`
- products linked through active client cycles
- memory namespaces and `deep_memories`
- `entity_relations`
- `integration_bindings`
- recent `events`

Root studies snapshot the whole Control Central ecosystem available in Supabase. Client studies scope context to that client; project studies preserve the wider business context while marking the selected project as the focus. Missing sources remain missing. The UI displays context coverage instead of inventing content.

## Value model

The opportunity score uses seven positive dimensions and one friction penalty:

```text
base =
  need        × 18%
+ recurrence  × 18%
+ pain        × 14%
+ market      × 12%
+ capture     × 16%
+ persistence × 12%
+ execution   × 10%

opportunity_score = base × (1 - 0.20 × friction/100)
```

The score is a decision aid, not a fact. Every opportunity should keep evidence references.

## Local setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

In development only, the UI can run without `LINK_STUDY_ADMIN_TOKEN`. In production the token is mandatory.

## Supabase

The migration in `supabase/migrations/20260901_add_link_study_lab.sql` has been designed for the existing project:

`LINK CONTROL CENTRAL / zgbnjlrxzvzpigmwidsp`

It is additive and creates:

- `study_studies`
- `study_snapshots`
- `study_evidence`
- `study_runs`
- `study_findings`
- `study_opportunities`

## MiroFish

MiroFish remains a separate service. LINK STUDY never embeds MiroFish source code.

Configure:

```env
MIROFISH_API_URL=https://your-mirofish-server.example.com
MIROFISH_API_TOKEN=optional-private-gateway-token
MIROFISH_MAX_ROUNDS=20
```

MiroFish should run as a separate long-lived service (VM/container), not inside Vercel serverless functions. If it is reachable from the internet, place it behind an authenticated gateway and set `MIROFISH_API_TOKEN`.

The adapter uses the official MiroFish API flow:

1. `POST /api/graph/ontology/generate`
2. `POST /api/graph/build`
3. poll `GET /api/graph/task/:taskId`
4. `POST /api/simulation/create`
5. `POST /api/simulation/prepare`
6. poll preparation
7. `POST /api/simulation/start`
8. poll run status
9. `POST /api/report/generate`
10. retrieve report

Before any snapshot is sent to MiroFish, LINK STUDY applies an external Export Gate: secret-like fields are always redacted and direct PII is redacted by default. Set `LINK_STUDY_ALLOW_PII_EXPORT=true` only for an explicitly approved study. The outbound copy receives its own SHA-256 digest and redaction version.

The first visible MiroFish action is enabled only when `/health` confirms the configured service is reachable.

## ChatGPT MCP

Endpoint:

```text
https://YOUR-DOMAIN/mcp
```

Authentication:

```text
Authorization: Bearer <LINK_MCP_TOKEN>
```

Available tools include:

- `study_health`
- `list_business_contexts`
- `list_studies`
- `get_study`
- `get_study_context` (full snapshot or selected sections)
- `create_study`
- `build_context_snapshot`
- `save_finding`
- `save_value_opportunity`
- `start_mirofish_study`
- `sync_mirofish_run`

## No Fake contract

Every visible mutation follows:

```text
real input → validation → execution → persistence → UI refresh → audit event
```

The application never promotes an inference, hypothesis or simulation into Control Central operational data automatically.
