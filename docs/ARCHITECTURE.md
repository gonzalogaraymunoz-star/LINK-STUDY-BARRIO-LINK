# LINK STUDY — Architecture v0.1

## Position in the LINK ecosystem

LINK STUDY is a consultative application. It is not a child operational control and it is not a replacement for LINK CONTROL CENTRAL.

```text
Human / ChatGPT
      │
      ▼
 LINK STUDY
      │
      ├──────── reads verified context ───────► LINK CONTROL CENTRAL / Supabase
      │                                          │
      │                                          └─ operational truth
      │
      └──────── optional experiments ─────────► MiroFish
                                                 │
                                                 └─ simulated world
```

## Boundary rule

- Operational tables are read-only from the study workflow.
- Study persistence is isolated in `study_*` tables.
- A study output can be `fact`, `inference`, `hypothesis`, `simulation`, or `proposal`.
- Only `fact` may describe a verified source as fact.
- Nothing in LINK STUDY promotes a study result into operational data automatically.

## Context scopes

### Root
Captures the ecosystem currently registered in Control Central: clients, projects, products, project briefs, requests, strategies, plans, work, memory, relations, integrations and recent events.

### Client
Captures one business plus its projects and scoped operational/commercial context.

### Project
Uses the full client context when the project belongs to a client and marks the selected project as `focusProject`.

Every capture stores a SHA-256 digest, source counts, contextual coverage and evidence rows.

## Study flow

```text
Question
  ↓
Create persistent study
  ↓
Build real context snapshot
  ↓
ChatGPT analysis and/or MiroFish simulation
  ↓
Findings with truth class
  ↓
Value opportunities with transparent scoring
  ↓
Human decision
```

## Value questions

The default research frame is:

1. Where does value exist?
2. What prevents that value from being realized or circulating?
3. What connection could release it recurrently?
4. Who benefits and who can capture part of the created value?
5. What happens when one value-producing connection feeds another?

## MiroFish boundary

MiroFish remains a separate AGPL application/service. LINK STUDY sends a generated reality snapshot through the official HTTP API. It does not vendor or modify MiroFish source code.

Because MiroFish runs long-lived simulation processes and persists local simulation state, deploy it on a VM/container host. Deploy LINK STUDY itself on Vercel.

## ChatGPT

`/mcp` exposes only study-specific tools. The connector can read real context, create snapshots, save classified findings/opportunities and trigger a configured MiroFish server. It does not expose generic writes to Control Central operational tables.
