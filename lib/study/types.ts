export type TruthClass = "fact" | "inference" | "hypothesis" | "simulation" | "proposal";
export type StudyType = "value_discovery" | "system_mapping" | "scenario" | "comparative" | "root_question";

export interface ScoreInput {
  need: number;
  recurrence: number;
  pain: number;
  market: number;
  capture: number;
  persistence: number;
  execution: number;
  friction: number;
}

export interface StudyContext {
  generatedAt: string;
  scope: "root" | "client" | "project";
  study: Record<string, unknown>;
  control: Record<string, unknown> | null;
  client: Record<string, unknown> | null;
  clients: Array<Record<string, unknown>>;
  clientProfile: Record<string, unknown> | null;
  clientProfiles: Array<Record<string, unknown>>;
  segment: Record<string, unknown> | null;
  focusProject: Record<string, unknown> | null;
  projects: Array<Record<string, unknown>>;
  projectBriefs: Array<Record<string, unknown>>;
  projectIntegrations: Array<Record<string, unknown>>;
  requests: Array<Record<string, unknown>>;
  commitments: Array<Record<string, unknown>>;
  deliverables: Array<Record<string, unknown>>;
  assets: Array<Record<string, unknown>>;
  needs: Array<Record<string, unknown>>;
  cycles: Array<Record<string, unknown>>;
  products: Array<Record<string, unknown>>;
  strategies: Array<Record<string, unknown>>;
  planAssignments: Array<Record<string, unknown>>;
  servicePlans: Array<Record<string, unknown>>;
  gestures: Array<Record<string, unknown>>;
  workItems: Array<Record<string, unknown>>;
  memories: Array<Record<string, unknown>>;
  relations: Array<Record<string, unknown>>;
  integrations: Array<Record<string, unknown>>;
  recentEvents: Array<Record<string, unknown>>;
}
