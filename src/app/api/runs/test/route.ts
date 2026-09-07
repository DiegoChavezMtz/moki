import { NextResponse } from "next/server";
import { escribir } from "../../../../adapters/blocks/escribir.ts";
import { CollectingRunEvents } from "../../../../adapters/events/collect.ts";
import { MiniMaxLLM, readMiniMaxConfig } from "../../../../adapters/llm/minimax.ts";
import { MemoryAgentRepository } from "../../../../adapters/persistence/memory-agent.ts";
import { createServerSupabaseClient } from "../../../../adapters/persistence/server-client.ts";
import type { Agent } from "../../../../core/domain/models.ts";
import { RunAgent } from "../../../../core/use-cases/run-agent.ts";

type TestRunInput = { input?: unknown; instruction?: unknown };
const RUN_TIMEOUT_MS = 35_000;

function unauthorized() {
  return NextResponse.json({ error: "Inicia sesión para ejecutar el agente." }, { status: 401 });
}

function parseInput(value: unknown): { input: string; instruction: string } | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const { input, instruction } = value as TestRunInput;
  if (typeof input !== "string" || typeof instruction !== "string" || !input.trim() || !instruction.trim()) return null;
  if (input.length > 20_000 || instruction.length > 10_000) return null;
  return { input, instruction };
}

function deadline<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("RUN_TIMEOUT")), timeoutMs);
    void promise.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
  });
}

/** Ruta temporal de comprobación del Sprint 2: un bloque Escribir, sesión real, sin persistencia. */
export async function POST(request: Request) {
  const traceId = crypto.randomUUID(); const startedAt = Date.now();
  const { data, error } = await (await createServerSupabaseClient()).auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return unauthorized();

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Envía una solicitud válida." }, { status: 400 }); }
  const parsed = parseInput(body);
  if (!parsed) return NextResponse.json({ error: "Incluye una instrucción y una entrada de texto válidas." }, { status: 400 });

  try {
    const id = () => crypto.randomUUID();
    const agent: Agent = {
      id: id(), ownerId: userId, title: "Prueba de ejecución", description: "Comprobación temporal de un bloque.",
      steps: [{ id: id(), blockType: "escribir", instruction: parsed.instruction }],
    };
    const repo = new MemoryAgentRepository();
    await repo.save(agent);
    const events = new CollectingRunEvents();
    const result = await deadline(RunAgent(agent.id, userId, parsed.input, {
      repo, events, newId: id, llm: new MiniMaxLLM(readMiniMaxConfig()), blocks: [escribir], currentDate: new Date().toISOString().slice(0, 10),
    }), RUN_TIMEOUT_MS);
    console.info("[runs/test] completed", { traceId, elapsedMs: Date.now() - startedAt });
    return NextResponse.json({ traceId, run: result.run, output: result.output ?? null, events: events.events });
  } catch (error) {
    const timeout = error instanceof Error && error.message === "RUN_TIMEOUT";
    console.error("[runs/test] failed", { traceId, elapsedMs: Date.now() - startedAt, timeout });
    return NextResponse.json({ traceId, error: timeout ? "La IA tardó demasiado en responder. Inténtalo de nuevo." : "La ejecución con IA no está disponible. Revisa la configuración de MiniMax e inténtalo de nuevo." }, { status: timeout ? 504 : 503 });
  }
}
