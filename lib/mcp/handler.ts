import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { listCatalog, createStudy, getStudy, getLatestSnapshot, saveFinding, saveOpportunity } from "@/lib/study/repository";
import { buildStudySnapshot } from "@/lib/study/context";
import { mirofishHealth, startMirofishStudy, syncMirofishRun } from "@/lib/mirofish/client";

function ok(text: string, structuredContent: Record<string, unknown>) {
  return { content: [{ type: "text" as const, text }], structuredContent: { ok: true, ...structuredContent } };
}
function fail(error: unknown) {
  const message = error instanceof Error ? error.message : "link_study_error";
  return { content: [{ type: "text" as const, text: message }], structuredContent: { ok: false, error: message }, isError: true };
}

export function createStudyMcpHandler() {
  return createMcpHandler((server) => {
    server.registerTool("study_health", {
      title: "Check LINK Study health",
      description: "Confirm that LINK Study, Control Central data and the optional MiroFish engine are reachable.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    }, async () => {
      try {
        const catalog = await listCatalog();
        const mirofish = await mirofishHealth();
        return ok("LINK Study is connected to Control Central live data.", { service: "link-study", dataMode: "supabase-live", clients: catalog.clients.length, projects: catalog.projects.length, studies: catalog.studies.length, mirofish });
      } catch (e) { return fail(e); }
    });

    server.registerTool("list_business_contexts", {
      title: "List business contexts",
      description: "List the real clients and projects currently available in Control Central for study. Do not invent missing businesses.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    }, async () => {
      try { const c = await listCatalog(); return ok("Returned live Control Central study contexts.", { controls: c.controls, clients: c.clients, projects: c.projects }); } catch (e) { return fail(e); }
    });

    server.registerTool("list_studies", {
      title: "List LINK studies",
      description: "List persistent studies in LINK Study.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    }, async () => {
      try { const c = await listCatalog(); return ok(`Found ${c.studies.length} persistent studies.`, { studies: c.studies }); } catch (e) { return fail(e); }
    });

    server.registerTool("get_study", {
      title: "Get study",
      description: "Get one study, its snapshots, findings, opportunities and simulation runs.",
      inputSchema: z.object({ study_id: z.string().uuid(), include_context: z.boolean().optional() }),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    }, async ({ study_id, include_context }) => {
      try { const study = await getStudy(study_id); const latestSnapshot = include_context ? await getLatestSnapshot(study_id, true) : null; return ok("Returned persistent LINK Study record.", { ...study, latestSnapshot }); } catch (e) { return fail(e); }
    });

    server.registerTool("get_study_context", {
      title: "Read study context snapshot",
      description: "Read the latest immutable Control Central context snapshot for analysis. Optionally request only named context sections to keep the response focused.",
      inputSchema: z.object({ study_id: z.string().uuid(), sections: z.array(z.string().min(1)).max(30).optional() }),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    }, async ({ study_id, sections }) => {
      try {
        const snapshot = await getLatestSnapshot(study_id, true);
        if (!snapshot) throw new Error("study_snapshot_required");
        const raw = (snapshot.context || {}) as Record<string, unknown>;
        const context = sections?.length
          ? Object.fromEntries(sections.filter((section) => section in raw).map((section) => [section, raw[section]]))
          : raw;
        return ok("Returned immutable Control Central context from the latest study snapshot.", { snapshot: { id: snapshot.id, snapshot_version: snapshot.snapshot_version, coverage: snapshot.coverage, source_counts: snapshot.source_counts, source_digest: snapshot.source_digest, created_at: snapshot.created_at }, context });
      } catch (e) { return fail(e); }
    });

    server.registerTool("create_study", {
      title: "Create study",
      description: "Create a real persistent study attached to a Control Central scope. This does not change the business operation.",
      inputSchema: z.object({
        control_id: z.string().uuid(), client_id: z.string().uuid().nullable().optional(), project_id: z.string().uuid().nullable().optional(),
        title: z.string().min(3), question: z.string().min(10), study_type: z.enum(["value_discovery","system_mapping","scenario","comparative","root_question"]).optional(), question_level: z.enum(["root","strategic","tactical"]).optional()
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    }, async (i) => {
      try { const study = await createStudy({ controlId: i.control_id, clientId: i.client_id, projectId: i.project_id, title: i.title, question: i.question, studyType: i.study_type, questionLevel: i.question_level, actor: "chatgpt" }); return ok("Study created and persisted.", { study }); } catch (e) { return fail(e); }
    });

    server.registerTool("build_context_snapshot", {
      title: "Build real context snapshot",
      description: "Capture immutable live context from Control Central for a study before analysis or simulation.",
      inputSchema: z.object({ study_id: z.string().uuid() }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    }, async ({ study_id }) => {
      try { const snapshot = await buildStudySnapshot(study_id, "chatgpt"); return ok("Real Control Central context snapshot created.", { snapshot }); } catch (e) { return fail(e); }
    });

    server.registerTool("save_finding", {
      title: "Save study finding",
      description: "Persist an analysis finding with an explicit truth class. Use inference/hypothesis/simulation rather than fact unless supported by evidence.",
      inputSchema: z.object({
        study_id: z.string().uuid(), snapshot_id: z.string().uuid().nullable().optional(), run_id: z.string().uuid().nullable().optional(),
        truth_class: z.enum(["fact","inference","hypothesis","simulation","proposal"]),
        finding_type: z.enum(["value","friction","connection","risk","system","market","behavior","other"]).optional(),
        title: z.string().min(2), body: z.string().min(2), confidence: z.number().min(0).max(1).nullable().optional(), value_score: z.number().min(0).max(100).nullable().optional(), evidence_refs: z.array(z.unknown()).optional(), structured_data: z.record(z.string(), z.unknown()).optional()
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    }, async (i) => {
      try { const finding = await saveFinding({ studyId: i.study_id, snapshotId: i.snapshot_id, runId: i.run_id, truthClass: i.truth_class, findingType: i.finding_type, title: i.title, body: i.body, confidence: i.confidence, valueScore: i.value_score, evidenceRefs: i.evidence_refs, structuredData: i.structured_data, actor: "chatgpt" }); return ok("Finding persisted with truth classification.", { finding }); } catch (e) { return fail(e); }
    });

    server.registerTool("save_value_opportunity", {
      title: "Save measured value opportunity",
      description: "Persist a latent-value opportunity and calculate its transparent opportunity score.",
      inputSchema: z.object({
        study_id: z.string().uuid(), snapshot_id: z.string().uuid().nullable().optional(), title: z.string().min(2), description: z.string().optional(), beneficiary: z.string().optional(), counterparty: z.string().optional(), value_type: z.string().optional(),
        need: z.number().min(0).max(100), recurrence: z.number().min(0).max(100), pain: z.number().min(0).max(100), market: z.number().min(0).max(100), capture: z.number().min(0).max(100), persistence: z.number().min(0).max(100), execution: z.number().min(0).max(100), friction: z.number().min(0).max(100), evidence_refs: z.array(z.unknown()).optional()
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    }, async (i) => {
      try { const opportunity = await saveOpportunity({ studyId: i.study_id, snapshotId: i.snapshot_id, title: i.title, description: i.description, beneficiary: i.beneficiary, counterparty: i.counterparty, valueType: i.value_type, scores: { need:i.need, recurrence:i.recurrence, pain:i.pain, market:i.market, capture:i.capture, persistence:i.persistence, execution:i.execution, friction:i.friction }, evidenceRefs: i.evidence_refs, actor: "chatgpt" }); return ok("Value opportunity persisted and scored.", { opportunity }); } catch (e) { return fail(e); }
    });

    server.registerTool("start_mirofish_study", {
      title: "Start MiroFish study",
      description: "Send the latest real context snapshot to the configured MiroFish engine and begin a simulation workflow. Fails if MiroFish is not connected.",
      inputSchema: z.object({ study_id: z.string().uuid() }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    }, async ({ study_id }) => {
      try { const run = await startMirofishStudy(study_id, "chatgpt"); return ok("MiroFish study started from the real snapshot.", { run }); } catch (e) { return fail(e); }
    });

    server.registerTool("sync_mirofish_run", {
      title: "Synchronize MiroFish run",
      description: "Advance/poll a persistent MiroFish run state through graph, preparation, simulation and report stages.",
      inputSchema: z.object({ run_id: z.string().uuid() }),
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    }, async ({ run_id }) => {
      try { const run = await syncMirofishRun(run_id, "chatgpt"); return ok("MiroFish run synchronized.", { run }); } catch (e) { return fail(e); }
    });
  }, {}, { basePath: "/mcp", maxDuration: 60 });
}
