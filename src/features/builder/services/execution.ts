import type { Agent } from "../../../core/domain/models.ts";
import { runSavedAgent, type UsageCall, type SearchSource } from "../../../shared/services/agent-run.ts";
import { saveAgent, type AgentDraft } from "./agents.ts";

type ExecutionResult = { output: string | null; sources: SearchSource[]; usage?: UsageCall[] };
type ExecutionDependencies = {
  save: (agent: AgentDraft, exists: boolean) => Promise<Agent>;
  run: (id: string, input: string, documents: ReadonlyMap<string, File>) => Promise<ExecutionResult>;
};

/** Persiste el borrador visible antes de ejecutarlo para que la prueba nunca use una versión anterior. */
export async function saveAndRunAgent(
  agent: AgentDraft,
  exists: boolean,
  input: string,
  documents: ReadonlyMap<string, File>,
  dependencies: ExecutionDependencies = { save: saveAgent, run: runSavedAgent },
): Promise<{ agent: Agent; result: ExecutionResult }> {
  const saved = await dependencies.save(agent, exists);
  const result = await dependencies.run(saved.id, input, documents);
  return { agent: saved, result };
}
