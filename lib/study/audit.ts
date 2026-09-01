import { getCentralSupabase } from "@/lib/supabase/server";

export async function auditStudyEvent(input: {
  controlId: string;
  clientId?: string | null;
  eventType: string;
  actor: string;
  objectType: string;
  objectId: string;
  payload?: Record<string, unknown>;
}) {
  const supabase = getCentralSupabase();
  if (!supabase) throw new Error("central_supabase_not_configured");
  const { error } = await supabase.from("events").insert({
    control_id: input.controlId,
    client_id: input.clientId || null,
    event_type: input.eventType,
    actor: input.actor,
    object_type: input.objectType,
    object_id: input.objectId,
    payload: input.payload || {},
  });
  if (error) throw new Error(`audit_failed:${error.message}`);
}
