export type Profile = { id: string; name: string; email: string };
export type Step = { id: string; blockType: string; instruction: string };
export type Agent = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  steps: Step[];
  forkedFrom?: string;
};
export type Run = { id: string; agentId: string; status: "running" | "done" | "failed"; input: string };
export type RunEvent =
  | { type: "step.started"; runId: string; stepId: string }
  | { type: "tool.called"; runId: string; stepId: string; tool: string; input: unknown }
  | { type: "tool.result"; runId: string; stepId: string; output: unknown }
  | { type: "step.finished"; runId: string; stepId: string; output: string }
  | { type: "run.finished"; runId: string; output: string }
  | { type: "run.failed"; runId: string; stepId?: string; reason: string };

// Identificadores técnicos del catálogo cerrado; los adaptadores aportan los manifiestos.
export const BLOCK_TYPES = ["pensar", "buscar-web", "leer-documento", "calcular", "escribir"] as const;

export function copyAgent(agent: Agent): Agent {
  return { ...agent, steps: agent.steps.map((step) => ({ ...step })) };
}
