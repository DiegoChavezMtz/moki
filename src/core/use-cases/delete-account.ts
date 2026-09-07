import { UnauthenticatedError } from "../domain/errors.ts";
import type { AccountDeletionGateway, AgentRepository } from "../ports/contracts.ts";

/** Elimina primero los agentes propios; los forks ajenos no pertenecen a esta cuenta. */
export async function DeleteAccount(userId: string, agents: AgentRepository, accounts: AccountDeletionGateway): Promise<void> {
  if (!userId.trim()) throw new UnauthenticatedError();
  for (const agent of await agents.listByOwner(userId)) await agents.delete(agent.id);
  await accounts.deleteUser(userId);
}
