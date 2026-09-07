import { ForbiddenError, UnauthenticatedError } from "../domain/errors.ts";
import type { Agent } from "../domain/models.ts";
import type { AgentRepository } from "../ports/contracts.ts";
import { ValidateAgent } from "./validate-agent.ts";

/** Guarda un agente nuevo o existente sin permitir transferir su propiedad. */
export async function SaveAgent(agent: Agent, requesterId: string, repo: AgentRepository): Promise<void> {
  if (!requesterId.trim()) throw new UnauthenticatedError();
  if (agent.ownerId !== requesterId) throw new ForbiddenError();
  ValidateAgent(agent);
  const existing = await repo.get(agent.id);
  if (existing && existing.ownerId !== requesterId) throw new ForbiddenError();
  await repo.save(agent);
}
