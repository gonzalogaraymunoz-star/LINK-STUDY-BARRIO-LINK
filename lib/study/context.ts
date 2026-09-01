import crypto from "node:crypto";
import { getCentralSupabase } from "@/lib/supabase/server";
import { auditStudyEvent } from "./audit";
import type { StudyContext } from "./types";

type Row = Record<string, unknown>;

function asRows(value: unknown): Row[] {
  return Array.isArray(value) ? (value as Row[]) : [];
}

function rowMentionsScope(row: Row, keys: string[]) {
  if (!keys.length) return false;
  const haystack = JSON.stringify(row).toLowerCase();
  return keys.some((key) => key && haystack.includes(key.toLowerCase()));
}

function coverageFor(context: StudyContext) {
  const checks = {
    identity: Boolean(context.client || context.clients.length || context.projects.length),
    profile: Boolean(context.clientProfile || context.clientProfiles.length),
    strategy: context.strategies.length > 0,
    demand: context.needs.length > 0,
    offering: context.products.length > 0 || context.projects.length > 0,
    operations: context.cycles.length > 0 || context.workItems.length > 0,
    memory: context.memories.length > 0,
    network: context.relations.length > 0,
    integrations: context.integrations.length > 0,
    activity: context.recentEvents.length > 0,
  };
  const values = Object.values(checks);
  const covered = values.filter(Boolean).length;
  return {
    ...checks,
    covered,
    total: values.length,
    percentage: Math.round((covered / values.length) * 100),
  };
}

export async function buildStudySnapshot(studyId: string, actor = "link-study") {
  const supabase = getCentralSupabase();
  if (!supabase) throw new Error("central_supabase_not_configured");

  const { data: study, error: studyError } = await supabase
    .from("study_studies")
    .select("*")
    .eq("id", studyId)
    .single();
  if (studyError || !study) throw new Error(studyError?.message || "study_not_found");

  const controlId = String(study.control_id);
  let clientId = study.client_id ? String(study.client_id) : null;
  const selectedProjectId = study.project_id ? String(study.project_id) : null;

  const { data: control, error: controlError } = await supabase.from("controls").select("*").eq("id", controlId).maybeSingle();
  if (controlError) throw new Error(controlError.message);

  let focusProject: Row | null = null;
  if (selectedProjectId) {
    const { data, error } = await supabase.from("projects").select("*").eq("id", selectedProjectId).maybeSingle();
    if (error) throw new Error(error.message);
    focusProject = (data || null) as Row | null;
    if (!clientId && focusProject?.client_id) clientId = String(focusProject.client_id);
  }

  let client: Row | null = null;
  if (clientId) {
    const { data, error } = await supabase.from("clients").select("*").eq("id", clientId).maybeSingle();
    if (error) throw new Error(error.message);
    client = (data || null) as Row | null;
  }

  const scope: StudyContext["scope"] = clientId ? (selectedProjectId ? "project" : "client") : selectedProjectId ? "project" : "root";

  let clients: Row[] = [];
  if (scope === "root") {
    const { data, error } = await supabase.from("clients").select("*").is("archived_at", null).order("created_at").limit(250);
    if (error) throw new Error(error.message);
    clients = asRows(data);
  } else if (client) {
    clients = [client];
  }

  let projects: Row[] = [];
  if (clientId) {
    const { data, error } = await supabase.from("projects").select("*").eq("client_id", clientId).eq("status", "active").order("sort_order").limit(250);
    if (error) throw new Error(error.message);
    projects = asRows(data);
  } else if (scope === "root") {
    const { data, error } = await supabase.from("projects").select("*").eq("status", "active").order("sort_order").limit(500);
    if (error) throw new Error(error.message);
    projects = asRows(data);
  } else if (focusProject) {
    projects = [focusProject];
  }
  if (focusProject && !projects.some((p) => String(p.id) === selectedProjectId)) projects.unshift(focusProject);

  const projectIds = projects.map((p) => String(p.id)).filter(Boolean);
  let projectBriefs: Row[] = [];
  if (projectIds.length) {
    const { data, error } = await supabase.from("project_briefs").select("*").in("project_id", projectIds).limit(500);
    if (error) throw new Error(error.message);
    projectBriefs = asRows(data);
  }

  let projectIntegrations: Row[] = [];
  let requests: Row[] = [];
  let commitments: Row[] = [];
  let deliverables: Row[] = [];
  let assets: Row[] = [];
  if (projectIds.length) {
    const [integrationsRes, requestsRes, commitmentsRes, deliverablesRes, assetsRes] = await Promise.all([
      supabase.from("project_integrations").select("*").in("project_id", projectIds).order("updated_at", { ascending: false }).limit(500),
      supabase.from("requests").select("*").in("project_id", projectIds).order("updated_at", { ascending: false }).limit(500),
      supabase.from("commitments").select("*").in("project_id", projectIds).order("updated_at", { ascending: false }).limit(500),
      supabase.from("deliverables").select("*").in("project_id", projectIds).order("updated_at", { ascending: false }).limit(500),
      supabase.from("assets").select("*").in("project_id", projectIds).order("updated_at", { ascending: false }).limit(500),
    ]);
    for (const result of [integrationsRes, requestsRes, commitmentsRes, deliverablesRes, assetsRes]) if (result.error) throw new Error(result.error.message);
    projectIntegrations = asRows(integrationsRes.data);
    requests = asRows(requestsRes.data);
    commitments = asRows(commitmentsRes.data);
    deliverables = asRows(deliverablesRes.data);
    assets = asRows(assetsRes.data);
  }

  let clientProfile: Row | null = null;
  let clientProfiles: Row[] = [];
  let segment: Row | null = null;
  let needs: Row[] = [];
  let cycles: Row[] = [];
  let strategies: Row[] = [];
  let planAssignments: Row[] = [];
  let servicePlans: Row[] = [];
  let gestures: Row[] = [];
  let workItems: Row[] = [];
  let recentEvents: Row[] = [];

  if (clientId) {
    const [profileRes, needsRes, cyclesRes, strategiesRes, plansRes, gesturesRes, clientRequestsRes, workRes, eventsRes] = await Promise.all([
      supabase.from("client_profiles").select("*").eq("client_id", clientId).maybeSingle(),
      supabase.from("needs").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(250),
      supabase.from("client_cycles").select("*").eq("client_id", clientId).order("updated_at", { ascending: false }).limit(250),
      supabase.from("client_strategies").select("*").eq("client_id", clientId).order("updated_at", { ascending: false }).limit(250),
      supabase.from("client_plan_assignments").select("*").eq("client_id", clientId).order("updated_at", { ascending: false }).limit(250),
      supabase.from("client_gestures").select("*").eq("client_id", clientId).order("updated_at", { ascending: false }).limit(300),
      supabase.from("requests").select("*").eq("client_id", clientId).order("updated_at", { ascending: false }).limit(300),
      supabase.from("work_items").select("*").eq("client_id", clientId).neq("status", "cancelled").order("updated_at", { ascending: false }).limit(300),
      supabase.from("events").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(200),
    ]);
    for (const result of [profileRes, needsRes, cyclesRes, strategiesRes, plansRes, gesturesRes, clientRequestsRes, workRes, eventsRes]) if (result.error) throw new Error(result.error.message);
    clientProfile = (profileRes.data || null) as Row | null;
    clientProfiles = clientProfile ? [clientProfile] : [];
    needs = asRows(needsRes.data);
    cycles = asRows(cyclesRes.data);
    strategies = asRows(strategiesRes.data);
    planAssignments = asRows(plansRes.data);
    gestures = asRows(gesturesRes.data);
    requests = [...requests, ...asRows(clientRequestsRes.data).filter((row) => !requests.some((existing) => String(existing.id) === String(row.id)))];
    workItems = asRows(workRes.data);
    recentEvents = asRows(eventsRes.data);

    if (client?.segment_id) {
      const { data, error } = await supabase.from("segments").select("*").eq("id", String(client.segment_id)).maybeSingle();
      if (error) throw new Error(error.message);
      segment = (data || null) as Row | null;
    }
  } else if (scope === "root") {
    const [profilesRes, needsRes, cyclesRes, strategiesRes, plansRes, gesturesRes, rootRequestsRes, workRes, eventsRes] = await Promise.all([
      supabase.from("client_profiles").select("*").order("updated_at", { ascending: false }).limit(500),
      supabase.from("needs").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("client_cycles").select("*").order("updated_at", { ascending: false }).limit(500),
      supabase.from("client_strategies").select("*").order("updated_at", { ascending: false }).limit(500),
      supabase.from("client_plan_assignments").select("*").eq("control_id", controlId).order("updated_at", { ascending: false }).limit(500),
      supabase.from("client_gestures").select("*").eq("control_id", controlId).order("updated_at", { ascending: false }).limit(500),
      supabase.from("requests").select("*").order("updated_at", { ascending: false }).limit(600),
      supabase.from("work_items").select("*").neq("status", "cancelled").order("updated_at", { ascending: false }).limit(600),
      supabase.from("events").select("*").eq("control_id", controlId).order("created_at", { ascending: false }).limit(300),
    ]);
    for (const result of [profilesRes, needsRes, cyclesRes, strategiesRes, plansRes, gesturesRes, rootRequestsRes, workRes, eventsRes]) if (result.error) throw new Error(result.error.message);
    clientProfiles = asRows(profilesRes.data);
    needs = asRows(needsRes.data);
    cycles = asRows(cyclesRes.data);
    strategies = asRows(strategiesRes.data);
    planAssignments = asRows(plansRes.data);
    gestures = asRows(gesturesRes.data);
    requests = [...requests, ...asRows(rootRequestsRes.data).filter((row) => !requests.some((existing) => String(existing.id) === String(row.id)))];
    workItems = asRows(workRes.data);
    recentEvents = asRows(eventsRes.data);
  } else {
    const { data, error } = await supabase.from("events").select("*").eq("control_id", controlId).order("created_at", { ascending: false }).limit(100);
    if (error) throw new Error(error.message);
    recentEvents = asRows(data);
  }

  let products: Row[] = [];
  if (scope === "root") {
    const { data, error } = await supabase.from("products").select("*").eq("active", true).order("updated_at", { ascending: false }).limit(500);
    if (error) throw new Error(error.message);
    products = asRows(data);
  } else {
    const productIds = [...new Set(cycles.map((c) => c.product_id).filter(Boolean).map(String))];
    if (productIds.length) {
      const { data, error } = await supabase.from("products").select("*").in("id", productIds).limit(500);
      if (error) throw new Error(error.message);
      products = asRows(data);
    }
  }

  const planIds = [...new Set(planAssignments.map((row) => row.plan_id).filter(Boolean).map(String))];
  if (scope === "root") {
    const { data, error } = await supabase.from("service_plans").select("*").eq("control_id", controlId).order("updated_at", { ascending: false }).limit(300);
    if (error) throw new Error(error.message);
    servicePlans = asRows(data);
  } else if (planIds.length) {
    const { data, error } = await supabase.from("service_plans").select("*").in("id", planIds).limit(300);
    if (error) throw new Error(error.message);
    servicePlans = asRows(data);
  }

  let memories: Row[] = [];
  if (scope === "root") {
    const { data: namespaces, error } = await supabase.from("memory_namespaces").select("id,scope_type,scope_key,label,metadata").eq("control_id", controlId).limit(500);
    if (error) throw new Error(error.message);
    const namespaceIds = asRows(namespaces).map((n) => String(n.id));
    if (namespaceIds.length) {
      const { data, error: memoryError } = await supabase
        .from("deep_memories")
        .select("id,namespace_id,memory_key,kind,content,structured_data,importance,confidence,source,source_ref,metadata,valid_from,valid_until,updated_at")
        .in("namespace_id", namespaceIds)
        .is("archived_at", null)
        .order("importance", { ascending: false })
        .limit(600);
      if (memoryError) throw new Error(memoryError.message);
      memories = asRows(data);
    }
  } else {
    const namespaceKeys = [clientId, client?.slug ? String(client.slug) : null, client?.global_id ? String(client.global_id) : null, selectedProjectId, focusProject?.slug ? String(focusProject.slug) : null].filter(Boolean) as string[];
    if (namespaceKeys.length) {
      const or = namespaceKeys.map((key) => `scope_key.eq.${key}`).join(",");
      const { data: namespaces, error } = await supabase.from("memory_namespaces").select("id,scope_type,scope_key,label,metadata").eq("control_id", controlId).or(or).limit(250);
      if (error) throw new Error(error.message);
      const namespaceIds = asRows(namespaces).map((n) => String(n.id));
      if (namespaceIds.length) {
        const { data, error: memoryError } = await supabase
          .from("deep_memories")
          .select("id,namespace_id,memory_key,kind,content,structured_data,importance,confidence,source,source_ref,metadata,valid_from,valid_until,updated_at")
          .in("namespace_id", namespaceIds)
          .is("archived_at", null)
          .order("importance", { ascending: false })
          .limit(350);
        if (memoryError) throw new Error(memoryError.message);
        memories = asRows(data);
      }
    }
  }

  const { data: relationData, error: relationError } = await supabase
    .from("entity_relations")
    .select("id,source_type,source_key,target_type,target_key,relation,label,metadata,updated_at")
    .eq("control_id", controlId)
    .order("updated_at", { ascending: false })
    .limit(scope === "root" ? 800 : 500);
  if (relationError) throw new Error(relationError.message);
  let relations = asRows(relationData);

  const { data: integrationData, error: integrationError } = await supabase
    .from("integration_bindings")
    .select("id,provider,global_id,entity_type,external_object,external_id,source_app,sync_status,last_synced_at,metadata,updated_at")
    .eq("control_id", controlId)
    .order("updated_at", { ascending: false })
    .limit(scope === "root" ? 500 : 300);
  if (integrationError) throw new Error(integrationError.message);
  let integrations = asRows(integrationData);

  if (scope !== "root") {
    const scopeKeys = [
      clientId,
      client?.slug ? String(client.slug) : null,
      client?.global_id ? String(client.global_id) : null,
      selectedProjectId,
      focusProject?.slug ? String(focusProject.slug) : null,
      ...projects.flatMap((p) => [p.id ? String(p.id) : "", p.slug ? String(p.slug) : ""]),
    ].filter(Boolean) as string[];
    relations = relations.filter((row) => rowMentionsScope(row, scopeKeys));
    integrations = integrations.filter((row) => rowMentionsScope(row, scopeKeys));
  }

  const context: StudyContext = {
    generatedAt: new Date().toISOString(),
    scope,
    study: study as Row,
    control: (control || null) as Row | null,
    client,
    clients,
    clientProfile,
    clientProfiles,
    segment,
    focusProject,
    projects,
    projectBriefs,
    projectIntegrations,
    requests,
    commitments,
    deliverables,
    assets,
    needs,
    cycles,
    products,
    strategies,
    planAssignments,
    servicePlans,
    gestures,
    workItems,
    memories,
    relations,
    integrations,
    recentEvents,
  };

  const sourceCounts = {
    clients: clients.length,
    client_profiles: clientProfiles.length,
    projects: projects.length,
    project_briefs: projectBriefs.length,
    project_integrations: projectIntegrations.length,
    requests: requests.length,
    commitments: commitments.length,
    deliverables: deliverables.length,
    assets: assets.length,
    needs: needs.length,
    cycles: cycles.length,
    products: products.length,
    strategies: strategies.length,
    plan_assignments: planAssignments.length,
    service_plans: servicePlans.length,
    gestures: gestures.length,
    work_items: workItems.length,
    memories: memories.length,
    relations: relations.length,
    integrations: integrations.length,
    events: recentEvents.length,
  };
  const coverage = { ...coverageFor(context), scope };
  const sourceDigest = crypto.createHash("sha256").update(JSON.stringify(context)).digest("hex");

  const { data: prior, error: priorError } = await supabase
    .from("study_snapshots")
    .select("snapshot_version")
    .eq("study_id", studyId)
    .order("snapshot_version", { ascending: false })
    .limit(1);
  if (priorError) throw new Error(priorError.message);
  const version = Number(prior?.[0]?.snapshot_version || 0) + 1;

  const { data: snapshot, error: snapshotError } = await supabase
    .from("study_snapshots")
    .insert({
      study_id: studyId,
      control_id: controlId,
      client_id: clientId,
      project_id: selectedProjectId,
      snapshot_version: version,
      context,
      coverage,
      source_counts: sourceCounts,
      source_digest: sourceDigest,
      created_by: actor,
    })
    .select("*")
    .single();
  if (snapshotError || !snapshot) throw new Error(snapshotError?.message || "snapshot_insert_failed");

  const evidenceRows = Object.entries({
    clients,
    client,
    client_profile: clientProfile,
    client_profiles: clientProfiles,
    segment,
    focus_project: focusProject,
    projects,
    project_briefs: projectBriefs,
    project_integrations: projectIntegrations,
    requests,
    commitments,
    deliverables,
    assets,
    needs,
    cycles,
    products,
    strategies,
    plan_assignments: planAssignments,
    service_plans: servicePlans,
    gestures,
    work_items: workItems,
    memories,
    relations,
    integrations,
    events: recentEvents,
  })
    .filter(([, value]) => value != null && (!Array.isArray(value) || value.length > 0))
    .map(([sourceTable, value]) => ({
      study_id: studyId,
      snapshot_id: snapshot.id,
      source_table: sourceTable,
      source_id: null,
      source_label: `${sourceTable} snapshot`,
      fact: { data: value },
      provenance: {
        truth_class: "fact",
        source: "supabase-live",
        captured_at: context.generatedAt,
        digest: sourceDigest,
        scope,
      },
    }));
  if (evidenceRows.length) {
    const { error } = await supabase.from("study_evidence").insert(evidenceRows);
    if (error) throw new Error(`evidence_insert_failed:${error.message}`);
  }

  const { error: updateError } = await supabase.from("study_studies").update({ status: "context_ready", updated_at: new Date().toISOString() }).eq("id", studyId);
  if (updateError) throw new Error(updateError.message);

  await auditStudyEvent({
    controlId,
    clientId,
    eventType: "study.snapshot.created",
    actor,
    objectType: "study_snapshot",
    objectId: String(snapshot.id),
    payload: { study_id: studyId, snapshot_version: version, scope, coverage, source_counts: sourceCounts, source_digest: sourceDigest },
  });

  return snapshot;
}
