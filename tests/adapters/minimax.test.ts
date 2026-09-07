import { test } from "node:test";
import assert from "node:assert/strict";
import Anthropic from "@anthropic-ai/sdk";
import { MINIMAX_ANTHROPIC_BASE_URL, MiniMaxLLM } from "../../src/adapters/llm/minimax.ts";
import { escribir } from "../../src/adapters/blocks/escribir.ts";

const request = { system: "Política del core", messages: [{ role: "user" as const, content: "Redacta un saludo." }] };
function setup(overrides: Record<string, unknown> = {}, status = 200) {
  const requests: Record<string, unknown>[] = [];
  const client = new Anthropic({
    apiKey: "test-key", maxRetries: 0,
    fetch: async (_url, options) => {
      requests.push(JSON.parse(String(options?.body)));
      return new Response(JSON.stringify({
        id: "msg_test", type: "message", role: "assistant", model: "MiniMax-M2.7",
        content: [{ type: "text", text: "Hola, bienvenido.", citations: null }],
        stop_reason: "end_turn", stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 5 }, ...overrides,
      }), { status, headers: { "content-type": "application/json" } });
    },
  });
  return { llm: new MiniMaxLLM({ apiKey: "test-key", model: "MiniMax-M2.7" }, client), requests };
}

test("Escribir implementa el catálogo sin herramientas", () => {
  assert.equal(escribir.manifest.type, "escribir");
  assert.equal(escribir.manifest.label, "Escribir / responder");
  assert.equal(escribir.tool, undefined);
});

test("MiniMax usa su endpoint compatible con Anthropic", () => {
  assert.equal(MINIMAX_ANTHROPIC_BASE_URL, "https://api.minimax.io/anthropic");
});

test("SDK transmite el modelo, la política y los mensajes; devuelve solo texto", async () => {
  const { llm, requests } = setup();
  assert.deepEqual(await llm.complete(request), { content: "Hola, bienvenido." });
  assert.deepEqual(requests, [{ model: "MiniMax-M2.7", max_tokens: 2048, system: request.system, messages: request.messages }]);
});

test("MiniMax no expone su razonamiento y conserva el texto final", async () => {
  const { llm } = setup({ content: [{ type: "thinking", thinking: "razonamiento interno", signature: "firma" }, { type: "text", text: "Respuesta final." }] });
  assert.deepEqual(await llm.complete(request), { content: "Respuesta final." });
});

for (const stop_reason of ["max_tokens", "pause_turn", null]) {
  test(`rechaza finalización incompleta: ${stop_reason}`, async () => {
    const { llm } = setup({ stop_reason });
    await assert.rejects(llm.complete(request), /no terminó/);
  });
}

test("devuelve la negativa del proveedor como texto", async () => {
  const { llm } = setup({ stop_reason: "refusal", content: [{ type: "text", text: "No puedo dar asesoría personalizada." }] });
  assert.match((await llm.complete(request)).content, /No puedo/);
});

test("rechaza texto vacío y contenido incompatible", async () => {
  for (const content of [[], [{ type: "text", text: " " }]]) {
    await assert.rejects(setup({ content }).llm.complete(request));
  }
});

test("acepta herramientas y conserva continuidad opaca; rechaza salida estructurada", async () => {
  const { llm, requests } = setup();
  const tool = { name: "x", description: "x", inputSchema: {} };
  const withTool = setup({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "t", name: "x", input: {} }] });
  const response = await withTool.llm.complete({ ...request, tools: [tool] });
  assert.equal(response.toolCalls?.[0].id, "t"); assert.ok(response.providerState);
  await assert.rejects(llm.complete({ ...request, outputSchema: {} }));
  await assert.rejects(llm.complete({ ...request, messages: [{ role: "tool", content: "x", toolCallId: "t" }] }));
  assert.equal(requests.length, 0);
});

test("tras un resultado de herramienta pide texto final sin habilitar otra llamada", async () => {
  const requests: Record<string, unknown>[] = [];
  const responses = [
    { id: "first", type: "message", role: "assistant", model: "MiniMax-M2.7", content: [{ type: "tool_use", id: "tool-1", name: "buscar", input: { query: "Moki" } }], stop_reason: "tool_use", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } },
    { id: "second", type: "message", role: "assistant", model: "MiniMax-M2.7", content: [{ type: "text", text: "Respuesta final." }], stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } },
  ];
  const client = new Anthropic({ apiKey: "test-key", maxRetries: 0, fetch: async (_url, options) => {
    requests.push(JSON.parse(String(options?.body)));
    return new Response(JSON.stringify(responses.shift()), { headers: { "content-type": "application/json" } });
  } });
  const llm = new MiniMaxLLM({ apiKey: "test-key", model: "MiniMax-M2.7" }, client);
  const tool = { name: "buscar", description: "Busca", inputSchema: {} };
  const first = await llm.complete({ ...request, tools: [tool] });
  const call = first.toolCalls?.[0];
  if (!call) throw new Error("El modelo debía solicitar una herramienta.");
  const final = await llm.complete({
    ...request,
    tools: [tool],
    providerState: first.providerState,
    messages: [...request.messages, { role: "assistant", content: first.content, toolCalls: [call] }, { role: "tool", content: "{\"sources\":[]}", toolCallId: call.id }],
  });
  assert.equal(final.content, "Respuesta final.");
  assert.equal("tools" in requests[1], false);
});

test("propaga el fallo HTTP al core sin reintentar", async () => {
  const { llm, requests } = setup({ type: "error", error: { type: "overloaded_error", message: "Test" } }, 529);
  await assert.rejects(llm.complete(request));
  assert.equal(requests.length, 1);
});
