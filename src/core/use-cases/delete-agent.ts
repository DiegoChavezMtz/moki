import { ForbiddenError, NotFoundError, UnauthenticatedError } from "../domain/errors.ts";
import type { AgentRepository } from "../ports/contracts.ts";

export async function DeleteAgent(agentId: string, requesterId: string, repo: AgentRepository): Promise<void> {
  if (!requesterId.trim()) throw new UnauthenticatedError();
  const agent = await repo.get(agentId);
  if (!agent) throw new NotFoundError();
  if (agent.ownerId !== requesterId) throw new ForbiddenError();
  await repo.delete(agentId);
}
