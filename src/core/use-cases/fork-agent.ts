import { NotFoundError, UnauthenticatedError } from "../domain/errors.ts";
import { copyAgent, type Agent } from "../domain/models.ts";
import type { AgentRepository, NewId } from "../ports/contracts.ts";

export async function ForkAgent(agentId: string, newOwnerId: string, repo: AgentRepository, newId: NewId): Promise<Agent> {
  if (!newOwnerId.trim()) throw new UnauthenticatedError();
  const original = await repo.get(agentId);
  if (!original) throw new NotFoundError();
  const copy = copyAgent(original);
  copy.id = newId();
  copy.ownerId = newOwnerId;
  copy.forkedFrom = original.id;
  await repo.save(copy);
  return copy;
}
