import { getCentralSupabase } from "@/lib/supabase/server";
import { auditStudyEvent } from "./audit";
import { makeStudyCode } from "./codes";
import { opportunityScore } from "./scoring";
import type { ScoreInput, StudyType, TruthClass } from "./types";

function db() {
  const supabase = getCentralSupabase();
  if (!supabase) throw new Error("central_supabase_not_configured");
  return supabase;
}

export async function listCatalog() {
  const supabase = db();
  const [controls, clients, projects, studies] = await Promise.all([
    supabase.from("controls").select("id,name,slug,scope,is_root,status,metadata").eq("status", "active").order("is_root", { ascending: false }),
    supabase.from("clients").select("id,name,slug,status,short_code,symbol,accent,control_id,segment_id,global_id,metadata").is("archived_at", null).order("created_at"),
    supabase.from("projects").select("id,name,slug,description,status,metadata,client_id,segment_id,parent_id,kind,sort_order,phase").eq("status", "active").order("sort_order"),
    supabase.from("study_studies").select("*").neq("status", "archived").order("created_at", { ascending: false }).limit(100),
  ]);
  for (const result of [controls, clients, projects, studies]) if (result.error) throw new Error(result.error.message);
  return { controls: controls.data || [], clients: clients.data || [], projects: projects.data || [], studies: studies.data || [] };
}

export async function createStudy(input: {
  controlId: string;
  clientId?: string | null;
  projectId?: string | null;
  title: string;
  question: string;
  studyType?: StudyType;
  questionLevel?: "root" | "strategic" | "tactical";
  actor?: string;
}) {
  const supabase = db();

  const { data: control, error: controlError } = await supabase
    .from("controls")
    .select("id,status")
    .eq("id", input.controlId)
    .maybeSingle();
  if (controlError || !control || control.status !== "active") throw new Error(controlError?.message || "control_not_available");

  let resolvedClientId = input.clientId || null;
  if (input.projectId) {
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id,client_id,status")
      .eq("id", input.projectId)
      .maybeSingle();
    if (projectError || !project || project.status !== "active") throw new Error(projectError?.message || "project_not_available");
    if (resolvedClientId && project.client_id && resolvedClientId !== project.client_id) throw new Error("project_client_scope_mismatch");
    if (!resolvedClientId && project.client_id) resolvedClientId = project.client_id;
  }

  let shortCode: string | null = null;
  if (resolvedClientId) {
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("short_code,control_id,status,archived_at")
      .eq("id", resolvedClientId)
      .maybeSingle();
    if (clientError || !client || client.archived_at || client.status !== "active") throw new Error(clientError?.message || "client_not_available");
    if (String(client.control_id) !== input.controlId) throw new Error("client_control_scope_mismatch");
    shortCode = client.short_code || null;
  }

  const row = {
    study_code: makeStudyCode(shortCode),
    control_id: input.controlId,
    client_id: resolvedClientId,
    project_id: input.projectId || null,
    title: input.title.trim(),
    question: input.question.trim(),
    study_type: input.studyType || "value_discovery",
    question_level: input.questionLevel || "root",
    status: "draft",
    source: "link-study",
    created_by: input.actor || "human",
    metadata: { no_fake: true },
  };
  const { data, error } = await supabase.from("study_studies").insert(row).select("*").single();
  if (error || !data) throw new Error(error?.message || "study_create_failed");
  await auditStudyEvent({
    controlId: input.controlId,
    clientId: resolvedClientId,
    eventType: "study.created",
    actor: input.actor || "human",
    objectType: "study",
    objectId: data.id,
    payload: { study_code: data.study_code, title: data.title, question: data.question, study_type: data.study_type, project_id: input.projectId || null },
  });
  return data;
}

export async function getStudy(studyId: string) {
  const supabase = db();
  const [study, snapshots, findings, opportunities, runs] = await Promise.all([
    supabase.from("study_studies").select("*").eq("id", studyId).single(),
    supabase.from("study_snapshots").select("id,study_id,snapshot_version,coverage,source_counts,source_digest,created_by,created_at").eq("study_id", studyId).order("snapshot_version", { ascending: false }),
    supabase.from("study_findings").select("*").eq("study_id", studyId).order("created_at", { ascending: false }),
    supabase.from("study_opportunities").select("*").eq("study_id", studyId).order("opportunity_score", { ascending: false, nullsFirst: false }),
    supabase.from("study_runs").select("*").eq("study_id", studyId).order("created_at", { ascending: false }),
  ]);
  for (const result of [study, snapshots, findings, opportunities, runs]) if (result.error) throw new Error(result.error.message);
  return { study: study.data, snapshots: snapshots.data || [], findings: findings.data || [], opportunities: opportunities.data || [], runs: runs.data || [] };
}

export async function getLatestSnapshot(studyId: string, includeContext = true): Promise<any | null> {
  const supabase = db();

  if (includeContext) {
    const { data, error } = await supabase
      .from("study_snapshots")
      .select("*")
      .eq("study_id", studyId)
      .order("snapshot_version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  const { data, error } = await supabase
    .from("study_snapshots")
    .select("id,study_id,snapshot_version,coverage,source_counts,source_digest,created_at")
    .eq("study_id", studyId)
    .order("snapshot_version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function saveFinding(input: {
  studyId: string;
  snapshotId?: string | null;
  runId?: string | null;
  truthClass: TruthClass;
  findingType?: "value" | "friction" | "connection" | "risk" | "system" | "market" | "behavior" | "other";
  title: string;
  body: string;
  confidence?: number | null;
  valueScore?: number | null;
  evidenceRefs?: unknown[];
  structuredData?: Record<string, unknown>;
  actor?: string;
}) {
  const supabase = db();
  const { data: study, error: studyError } = await supabase.from("study_studies").select("control_id,client_id").eq("id", input.studyId).single();
  if (studyError || !study) throw new Error(studyError?.message || "study_not_found");
  const { data, error } = await supabase.from("study_findings").insert({
    study_id: input.studyId,
    snapshot_id: input.snapshotId || null,
    run_id: input.runId || null,
    truth_class: input.truthClass,
    finding_type: input.findingType || "other",
    title: input.title.trim(),
    body: input.body.trim(),
    confidence: input.confidence ?? null,
    value_score: input.valueScore ?? null,
    evidence_refs: input.evidenceRefs || [],
    structured_data: input.structuredData || {},
    actor: input.actor || "unknown",
  }).select("*").single();
  if (error || !data) throw new Error(error?.message || "finding_insert_failed");
  await auditStudyEvent({
    controlId: study.control_id,
    clientId: study.client_id,
    eventType: "study.finding.created",
    actor: input.actor || "unknown",
    objectType: "study_finding",
    objectId: data.id,
    payload: { study_id: input.studyId, truth_class: input.truthClass, finding_type: data.finding_type },
  });
  return data;
}

export async function saveOpportunity(input: {
  studyId: string;
  snapshotId?: string | null;
  title: string;
  description?: string;
  beneficiary?: string;
  counterparty?: string;
  valueType?: string;
  scores: ScoreInput;
  evidenceRefs?: unknown[];
  actor?: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = db();
  const { data: study, error: studyError } = await supabase.from("study_studies").select("control_id,client_id").eq("id", input.studyId).single();
  if (studyError || !study) throw new Error(studyError?.message || "study_not_found");
  const score = opportunityScore(input.scores);
  const { data, error } = await supabase.from("study_opportunities").insert({
    study_id: input.studyId,
    snapshot_id: input.snapshotId || null,
    title: input.title.trim(),
    description: input.description || null,
    beneficiary: input.beneficiary || null,
    counterparty: input.counterparty || null,
    value_type: input.valueType || null,
    need_score: input.scores.need,
    recurrence_score: input.scores.recurrence,
    pain_score: input.scores.pain,
    market_score: input.scores.market,
    capture_score: input.scores.capture,
    persistence_score: input.scores.persistence,
    execution_score: input.scores.execution,
    friction_score: input.scores.friction,
    opportunity_score: score,
    evidence_refs: input.evidenceRefs || [],
    status: "proposed",
    created_by: input.actor || "unknown",
    metadata: input.metadata || {},
  }).select("*").single();
  if (error || !data) throw new Error(error?.message || "opportunity_insert_failed");
  await auditStudyEvent({
    controlId: study.control_id,
    clientId: study.client_id,
    eventType: "study.opportunity.created",
    actor: input.actor || "unknown",
    objectType: "study_opportunity",
    objectId: data.id,
    payload: { study_id: input.studyId, title: data.title, opportunity_score: score },
  });
  return data;
}
