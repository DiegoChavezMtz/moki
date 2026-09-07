export type SearchSource = { title: string; url: string; age?: string; pageAge?: string };
type RunPayload = { output?: unknown; run?: { status?: unknown }; events?: unknown };

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function failedRunReason(payload: RunPayload): string | null {
  if (payload.run?.status !== "failed" || !Array.isArray(payload.events)) return null;
  const failed = payload.events.find((event) => isRecord(event) && event.type === "run.failed");
  return isRecord(failed) && typeof failed.reason === "string" ? failed.reason : "No pudimos completar esta ejecución. Inténtalo de nuevo.";
}
function isSearchSource(value: unknown): value is SearchSource {
  return isRecord(value) && typeof value.title === "string" && typeof value.url === "string" && (value.age === undefined || typeof value.age === "string") && (value.pageAge === undefined || typeof value.pageAge === "string");
}
function sourcesFromEvents(payload: RunPayload): SearchSource[] {
  if (!Array.isArray(payload.events)) return [];
  return payload.events.flatMap((event) => isRecord(event) && event.type === "tool.result" && isRecord(event.output) && Array.isArray(event.output.sources) ? event.output.sources.filter(isSearchSource) : []);
}

/** Ejecuta un agente guardado mediante la ruta autenticada, con archivos por bloque de lectura. */
export async function runSavedAgent(id: string, input: string, documents: ReadonlyMap<string, File>): Promise<{ output: string | null; sources: SearchSource[] }> {
  const form = new FormData(); form.set("input", input); documents.forEach((file, stepId) => form.set(`document:${stepId}`, file));
  const response = await fetch(`/api/agents/${id}/run`, { method: "POST", body: form });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof body === "object" && body !== null && "error" in body && typeof body.error === "string" ? body.error : "No pudimos ejecutar el agente.");
  if (!isRecord(body)) throw new Error("No pudimos leer la respuesta de la ejecución.");
  const failed = failedRunReason(body); if (failed) throw new Error(failed);
  return { output: typeof body.output === "string" ? body.output : null, sources: sourcesFromEvents(body) };
}
