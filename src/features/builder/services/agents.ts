import type { Agent, Step } from "../../../core/domain/models.ts";

export type AgentDraft = { id: string; title: string; description: string; steps: Step[] };

async function request(path: string, method: "POST" | "PATCH", agent: AgentDraft): Promise<Agent> {
  const response = await fetch(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(agent) });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || typeof body !== "object" || body === null || !("agent" in body)) {
    const message = typeof body === "object" && body !== null && "error" in body && typeof body.error === "string" ? body.error : "No pudimos guardar el agente. Inténtalo de nuevo.";
    throw new Error(message);
  }
  return (body as { agent: Agent }).agent;
}

/** Servicio de UI: la autorización y RPC permanecen detrás de rutas autenticadas. */
export function saveAgent(agent: AgentDraft, exists: boolean): Promise<Agent> {
  return request(exists ? `/api/agents/${agent.id}` : "/api/agents", exists ? "PATCH" : "POST", agent);
}

export async function listAgents(): Promise<Agent[]> {
  const response = await fetch("/api/agents"); const body: unknown = await response.json().catch(() => null);
  if (!response.ok || typeof body !== "object" || body === null || !("agents" in body) || !Array.isArray(body.agents)) throw new Error("No pudimos cargar los agentes.");
  return body.agents as Agent[];
}

export async function deleteAgent(id: string): Promise<void> {
  const response = await fetch(`/api/agents/${id}`, { method: "DELETE" });
  if (!response.ok) { const body: unknown = await response.json().catch(() => null); throw new Error(typeof body === "object" && body !== null && "error" in body && typeof body.error === "string" ? body.error : "No pudimos eliminar el agente."); }
}
