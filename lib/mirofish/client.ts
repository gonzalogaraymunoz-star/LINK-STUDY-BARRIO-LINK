import { getCentralSupabase } from "@/lib/supabase/server";
import { auditStudyEvent } from "@/lib/study/audit";
import { getLatestSnapshot } from "@/lib/study/repository";
import { prepareExternalStudyContext } from "@/lib/study/export";

const timeoutMs = 15000;

function baseUrl() {
  return (process.env.MIROFISH_API_URL || "").replace(/\/$/, "");
}

async function request(path: string, init?: RequestInit, timeout = timeoutMs) {
  const base = baseUrl();
  if (!base) throw new Error("mirofish_not_configured");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const token = process.env.MIROFISH_API_TOKEN || "";
    const headers = new Headers(init?.headers || {});
    if (token && !headers.has("authorization")) headers.set("authorization", `Bearer ${token}`);
    const response = await fetch(`${base}${path}`, { ...init, headers, signal: controller.signal, cache: "no-store" });
    const text = await response.text();
    let json: any = {};
    try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
    if (!response.ok || json?.success === false) throw new Error(json?.error || `mirofish_http_${response.status}`);
    return json;
  } finally {
    clearTimeout(timer);
  }
}

export async function mirofishHealth() {
  if (!baseUrl()) return { configured: false, reachable: false, service: null };
  try {
    const data = await request("/health", undefined, 5000);
    return { configured: true, reachable: data?.status === "ok", service: data };
  } catch (error) {
    return { configured: true, reachable: false, service: null, error: error instanceof Error ? error.message : "mirofish_health_failed" };
  }
}

function contextDocument(snapshot: any) {
  const exported = prepareExternalStudyContext(snapshot.context);
  return {
    ...exported,
    document: [
      "LINK STUDY — REDACTED REALITY SNAPSHOT",
      "",
      "IMPORTANT TRUTH RULES:",
      "- REAL FACTS originate from the linked Control Central Supabase snapshot.",
      "- Secrets are always redacted before external export.",
      `- Direct PII export is ${exported.allowPii ? "explicitly enabled" : "disabled and redacted"}.`,
      "- Simulation output must never be represented as a real-world fact.",
      "- Focus on latent value, blocked value, missing connections, recurrence, friction, and value capture.",
      "",
      "REAL FACTS (EXTERNAL-SAFE COPY):",
      exported.serialized,
      "",
      "CONTEXT COVERAGE:",
      JSON.stringify(snapshot.coverage, null, 2),
      "",
      `EXPORT DIGEST: ${exported.exportDigest}`,
      `REDACTION VERSION: ${exported.redactionVersion}`,
    ].join("\n"),
  };
}

export async function startMirofishStudy(studyId: string, actor = "link-study") {
  const supabase = getCentralSupabase();
  if (!supabase) throw new Error("central_supabase_not_configured");
  const health = await mirofishHealth();
  if (!health.reachable) throw new Error("mirofish_unreachable");

  const { data: study, error: studyError } = await supabase.from("study_studies").select("*").eq("id", studyId).single();
  if (studyError || !study) throw new Error(studyError?.message || "study_not_found");
  const snapshot = await getLatestSnapshot(studyId, true);
  if (!snapshot) throw new Error("study_snapshot_required");

  const external = contextDocument(snapshot);
  const { data: run, error: runError } = await supabase.from("study_runs").insert({
    study_id: studyId,
    snapshot_id: snapshot.id,
    engine: "mirofish",
    status: "running",
    request_payload: {
      question: study.question,
      snapshot_id: snapshot.id,
      max_rounds: Number(process.env.MIROFISH_MAX_ROUNDS || 20),
      export_digest: external.exportDigest,
      redaction_version: external.redactionVersion,
      pii_export: external.allowPii,
    },
    response_payload: { stage: "ontology" },
    started_at: new Date().toISOString(),
  }).select("*").single();
  if (runError || !run) throw new Error(runError?.message || "run_create_failed");

  try {
    const form = new FormData();
    form.append("simulation_requirement", study.question);
    form.append("project_name", `${study.study_code} ${study.title}`);
    form.append("additional_context", "Study latent value and system behavior. Preserve the difference between facts, inference, hypothesis and simulation.");
    form.append("files", new Blob([external.document], { type: "text/plain" }), `${study.study_code}-snapshot.txt`);

    const ontology = await request("/api/graph/ontology/generate", { method: "POST", body: form }, 60000);
    const miroProjectId = ontology?.data?.project_id;
    if (!miroProjectId) throw new Error("mirofish_project_id_missing");

    const build = await request("/api/graph/build", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: miroProjectId, graph_name: study.study_code }),
    }, 30000);
    const graphTaskId = build?.data?.task_id;
    const graphId = build?.data?.graph_id || null;
    if (!graphTaskId && !graphId) throw new Error("mirofish_graph_task_missing");

    const payload = {
      stage: graphId ? "graph_ready" : "graph_building",
      miro_project_id: miroProjectId,
      graph_task_id: graphTaskId || null,
      graph_id: graphId,
      ontology: ontology?.data?.ontology || null,
      analysis_summary: ontology?.data?.analysis_summary || null,
    };
    const { error } = await supabase.from("study_runs").update({ external_id: miroProjectId, response_payload: payload, updated_at: new Date().toISOString() }).eq("id", run.id);
    if (error) throw new Error(error.message);
    await supabase.from("study_studies").update({ status: "running", updated_at: new Date().toISOString() }).eq("id", studyId);
    await auditStudyEvent({ controlId: study.control_id, clientId: study.client_id, eventType: "study.mirofish.started", actor, objectType: "study_run", objectId: run.id, payload: { study_id: studyId, miro_project_id: miroProjectId, graph_task_id: graphTaskId || null } });
    return { ...run, response_payload: payload, external_id: miroProjectId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "mirofish_start_failed";
    await supabase.from("study_runs").update({ status: "failed", error: message, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", run.id);
    await supabase.from("study_studies").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", studyId);
    throw error;
  }
}

function statusOf(data: any) {
  return String(data?.data?.status || data?.status || data?.data?.task?.status || data?.task?.status || "").toLowerCase();
}

async function resolveGraphId(projectId: string, fallback?: string | null) {
  if (fallback) return fallback;
  const project = await request(`/api/graph/project/${encodeURIComponent(projectId)}`);
  return project?.data?.graph_id || null;
}

export async function syncMirofishRun(runId: string, actor = "link-study") {
  const supabase = getCentralSupabase();
  if (!supabase) throw new Error("central_supabase_not_configured");
  const { data: run, error: runError } = await supabase.from("study_runs").select("*").eq("id", runId).single();
  if (runError || !run) throw new Error(runError?.message || "run_not_found");
  if (run.engine !== "mirofish") throw new Error("not_a_mirofish_run");
  if (["completed", "failed", "cancelled"].includes(run.status)) return run;
  const payload: any = { ...(run.response_payload || {}) };

  try {
    if (payload.stage === "graph_building") {
      const task = await request(`/api/graph/task/${encodeURIComponent(payload.graph_task_id)}`);
      payload.graph_task = task?.data || task;
      const s = statusOf(task);
      if (["failed", "error"].includes(s)) throw new Error(task?.error || task?.data?.error || "mirofish_graph_failed");
      if (["completed", "success", "succeeded", "done"].includes(s)) {
        payload.graph_id = await resolveGraphId(payload.miro_project_id, payload.graph_id);
        if (!payload.graph_id) throw new Error("mirofish_graph_id_missing");
        payload.stage = "graph_ready";
      }
    }

    if (payload.stage === "graph_ready") {
      const sim = await request("/api/simulation/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project_id: payload.miro_project_id, graph_id: payload.graph_id, enable_twitter: true, enable_reddit: true }),
      }, 30000);
      payload.simulation_id = sim?.data?.simulation_id;
      if (!payload.simulation_id) throw new Error("mirofish_simulation_id_missing");
      const prep = await request("/api/simulation/prepare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ simulation_id: payload.simulation_id, use_llm_for_profiles: true }),
      }, 30000);
      payload.prepare_task_id = prep?.data?.task_id || prep?.task_id || null;
      payload.stage = "preparing";
    }

    if (payload.stage === "preparing") {
      const prep = await request("/api/simulation/prepare/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ simulation_id: payload.simulation_id, task_id: payload.prepare_task_id || undefined }),
      });
      payload.prepare_status = prep?.data || prep;
      const s = statusOf(prep);
      if (["failed", "error"].includes(s)) throw new Error(prep?.error || prep?.data?.error || "mirofish_prepare_failed");
      if (["ready", "completed", "success", "succeeded", "done"].includes(s)) {
        await request("/api/simulation/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ simulation_id: payload.simulation_id, max_rounds: Number(process.env.MIROFISH_MAX_ROUNDS || 20), enable_graph_memory_update: true }),
        }, 30000);
        payload.stage = "running";
      }
    }

    if (payload.stage === "running") {
      const state = await request(`/api/simulation/${encodeURIComponent(payload.simulation_id)}/run-status/detail`);
      payload.run_status = state?.data || state;
      const s = statusOf(state);
      if (["failed", "error"].includes(s)) throw new Error(state?.error || state?.data?.error || "mirofish_run_failed");
      if (["completed", "finished", "done", "stopped"].includes(s)) {
        const report = await request("/api/report/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ simulation_id: payload.simulation_id }),
        }, 30000);
        payload.report_id = report?.data?.report_id || report?.report_id;
        if (!payload.report_id) throw new Error("mirofish_report_id_missing");
        payload.stage = "reporting";
      }
    }

    if (payload.stage === "reporting") {
      const reportStatus = await request(`/api/report/generate/status?report_id=${encodeURIComponent(payload.report_id)}`);
      payload.report_status = reportStatus?.data || reportStatus;
      const s = statusOf(reportStatus);
      if (["failed", "error"].includes(s)) throw new Error(reportStatus?.error || reportStatus?.data?.error || "mirofish_report_failed");
      if (["completed", "success", "succeeded", "done"].includes(s)) {
        const report = await request(`/api/report/${encodeURIComponent(payload.report_id)}`);
        payload.report = report?.data || report;
        payload.stage = "completed";
      }
    }

    const completed = payload.stage === "completed";
    const { error } = await supabase.from("study_runs").update({
      status: completed ? "completed" : "running",
      response_payload: payload,
      completed_at: completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq("id", runId);
    if (error) throw new Error(error.message);

    if (completed) {
      await supabase.from("study_studies").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", run.study_id);
      const { data: study } = await supabase.from("study_studies").select("control_id,client_id").eq("id", run.study_id).single();
      if (study) await auditStudyEvent({ controlId: study.control_id, clientId: study.client_id, eventType: "study.mirofish.completed", actor, objectType: "study_run", objectId: runId, payload: { study_id: run.study_id, simulation_id: payload.simulation_id, report_id: payload.report_id } });
    }
    return { ...run, status: completed ? "completed" : "running", response_payload: payload };
  } catch (error) {
    const message = error instanceof Error ? error.message : "mirofish_sync_failed";
    await supabase.from("study_runs").update({ status: "failed", error: message, response_payload: payload, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", runId);
    await supabase.from("study_studies").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", run.study_id);
    throw error;
  }
}
