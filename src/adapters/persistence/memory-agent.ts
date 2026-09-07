import type { Agent } from "../../core/domain/models.ts";
import { copyAgent } from "../../core/domain/models.ts";
import type { AgentRepository } from "../../core/ports/contracts.ts";

/** Repositorio efímero para la ruta de comprobación del Sprint 2; no persiste agentes. */
export class MemoryAgentRepository implements AgentRepository {
  private readonly agents = new Map<string, Agent>();

  async save(agent: Agent): Promise<void> { this.agents.set(agent.id, copyAgent(agent)); }
  async get(id: string): Promise<Agent | null> {
    const agent = this.agents.get(id);
    return agent ? copyAgent(agent) : null;
  }
  async listAll(): Promise<Agent[]> { return [...this.agents.values()].map(copyAgent); }
  async listByOwner(ownerId: string): Promise<Agent[]> { return (await this.listAll()).filter((agent) => agent.ownerId === ownerId); }
  async delete(id: string): Promise<void> { this.agents.delete(id); }
}
