import { NextResponse } from "next/server";
import { createBuscarWeb, readBraveSearchConfig } from "../../../../../adapters/blocks/buscar-web.ts";
import { calcular } from "../../../../../adapters/blocks/calcular.ts";
import { escribir } from "../../../../../adapters/blocks/escribir.ts";
import { createLeerDocumento } from "../../../../../adapters/blocks/leer-documento.ts";
import { CollectingRunEvents } from "../../../../../adapters/events/collect.ts";
import { MiniMaxLLM, readMiniMaxConfig } from "../../../../../adapters/llm/minimax.ts";
import { createExecutionDocumentStorage, createStoredDocumentSource, withExecutionDocumentCleanup, type StoredExecutionDocument } from "../../../../../adapters/persistence/execution-documents.ts";
import { SupabaseAgentRepository } from "../../../../../adapters/persistence/supabase-agent.ts";
import { createServerSupabaseClient } from "../../../../../adapters/persistence/server-client.ts";
import { RunAgent } from "../../../../../core/use-cases/run-agent.ts";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  const client = await createServerSupabaseClient(); const { data, error } = await client.auth.getClaims(); const userId = data?.claims?.sub;
  if (error || !userId) return NextResponse.json({ error: "Inicia sesión para ejecutar el agente." }, { status: 401 });
  try {
    const form = await request.formData(); const input = form.get("input");
    if (typeof input !== "string" || !input.trim()) return NextResponse.json({ error: "Escribe un caso de prueba para ejecutar el agente." }, { status: 400 });
    const agentId = (await params).id; const repo = new SupabaseAgentRepository(client); const agent = await repo.get(agentId);
    if (!agent) return NextResponse.json({ error: "No encontramos este agente." }, { status: 404 });
    const runId = crypto.randomUUID(); const storage = createExecutionDocumentStorage(client); const documents: StoredExecutionDocument[] = [];
    for (const step of agent.steps.filter((item) => item.blockType === "leer-documento")) {
      const file = form.get(`document:${step.id}`);
      if (!(file instanceof File)) return NextResponse.json({ error: `Carga un documento para el bloque ${agent.steps.indexOf(step) + 1}.` }, { status: 400 });
    }
    const result = await withExecutionDocumentCleanup(storage, documents, async () => {
      for (const step of agent.steps.filter((item) => item.blockType === "leer-documento")) {
        const file = form.get(`document:${step.id}`) as File;
        documents.push(await storage.upload({ name: file.name, contentType: file.type, bytes: new Uint8Array(await file.arrayBuffer()) }, { userId, runId, agentId, stepId: step.id }));
      }
      const events = new CollectingRunEvents(); let first = true;
      const blocks = [escribir, calcular, createBuscarWeb(readBraveSearchConfig()), createLeerDocumento(createStoredDocumentSource(storage, new Map(documents.map((document) => [document.stepId, document]))))];
      const execution = await RunAgent(agentId, userId, input, { repo, events, newId: () => { if (first) { first = false; return runId; } return crypto.randomUUID(); }, llm: new MiniMaxLLM(readMiniMaxConfig()), blocks, currentDate: new Date().toISOString().slice(0, 10) });
      return { execution, events };
    });
    return NextResponse.json({ run: result.execution.run, output: result.execution.output ?? null, events: result.events.events });
  } catch { return NextResponse.json({ error: "No pudimos completar esta ejecución. Revisa los datos y vuelve a intentar." }, { status: 503 }); }
}
