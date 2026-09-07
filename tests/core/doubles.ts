import type { Agent, RunEvent } from "../../src/core/domain/models.ts";
import { copyAgent } from "../../src/core/domain/models.ts";
import type { AgentRepository, BlockPlugin, LLMProvider, LLMRequest, LLMResponse, RunEventSink } from "../../src/core/ports/contracts.ts";

export class MemoryAgentRepository implements AgentRepository {
  private agents = new Map<string, Agent>();
  async save(agent: Agent) { this.agents.set(agent.id, copyAgent(agent)); }
  async get(id: string) { const agent = this.agents.get(id); return agent ? copyAgent(agent) : null; }
  async listAll() { return [...this.agents.values()].map(copyAgent); }
  async listByOwner(ownerId: string) { return (await this.listAll()).filter((agent) => agent.ownerId === ownerId); }
  async delete(id: string) { this.agents.delete(id); }
}
export class FakeLLM implements LLMProvider {
  readonly requests: LLMRequest[] = [];
  readonly responses: (LLMResponse | Error)[];
  constructor(responses: (LLMResponse | Error)[]) { this.responses = responses; }
  async complete(request: LLMRequest): Promise<LLMResponse> {
    this.requests.push(structuredClone(request));
    const response = this.responses.shift();
    if (!response) throw new Error("El falso LLM no tiene respuestas configuradas");
    if (response instanceof Error) throw response;
    return response;
  }
}
export class MemoryEvents implements RunEventSink {
  readonly events: RunEvent[] = [];
  emit(event: RunEvent) { this.events.push(structuredClone(event)); }
}
export const blocks: BlockPlugin[] = ["pensar", "escribir"].map((type) => ({
  manifest: { type, label: type, color: "", icon: "", placeholder: "" },
}));
export function agent(): Agent {
  return { id: "original", ownerId: "ana", title: "Revisar y redactar", description: "Ordena ideas y redacta un resumen.", steps: [
    { id: "uno", blockType: "pensar", instruction: "Ordena los puntos principales." },
    { id: "dos", blockType: "escribir", instruction: "Redacta un resumen de los puntos." },
  ] };
}
