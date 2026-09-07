import { test } from "node:test";
import assert from "node:assert/strict";
import { createBuscarWeb } from "../../src/adapters/blocks/buscar-web.ts";

function setup(body: unknown, status = 200, now = () => new Date("2026-09-07T12:00:00.000Z")) {
  const requests: { url: URL; init: RequestInit | undefined }[] = [];
  const block = createBuscarWeb({
    apiKey: "brave-test-key",
    fetch: async (url, init) => {
      requests.push({ url: new URL(url.toString()), init });
      return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    },
    now,
  });
  if (!block.tool) throw new Error("El bloque de prueba debe incluir herramienta.");
  return { tool: block.tool, requests };
}

test("Buscar en internet expone el bloque y conserva fuentes verificables", async () => {
  const { tool, requests } = setup({ web: { results: [
    { title: "Fuente oficial", url: "https://ejemplo.gob.mx/noticia", description: "Información pública." },
    { title: "Ignorar", url: "javascript:alert(1)", description: "" },
  ] } });
  assert.equal(tool.schema.name, "buscar_en_internet");
  const output = await tool.execute({ query: "noticias de ejemplo" }, { runId: "r", agentId: "a", stepId: "s", userId: "u" });
  assert.deepEqual(output, { query: "noticias de ejemplo", sources: [{ title: "Fuente oficial", url: "https://ejemplo.gob.mx/noticia", excerpt: "Información pública." }] });
  assert.equal(requests[0].url.searchParams.get("q"), "noticias de ejemplo");
  assert.equal(requests[0].url.searchParams.get("count"), "5");
  assert.equal((requests[0].init?.headers as Record<string, string>)["X-Subscription-Token"], "brave-test-key");
});

test("Buscar en internet traduce filtros de fecha al formato de Brave", async () => {
  const relative = setup({ web: { results: [] } });
  await relative.tool.execute({ query: "cambio reciente", period: "week" }, { runId: "r", agentId: "a", stepId: "s", userId: "u" });
  assert.equal(relative.requests[0].url.searchParams.get("freshness"), "pw");

  const exact = setup({ web: { results: [] } });
  await exact.tool.execute({ query: "archivo", from: "2026-01-01", to: "2026-01-31" }, { runId: "r", agentId: "a", stepId: "s", userId: "u" });
  assert.equal(exact.requests[0].url.searchParams.get("freshness"), "2026-01-01to2026-01-31");
});

test("Buscar en internet conserva fechas y descarta fuentes sin fecha verificable fuera del periodo", async () => {
  const { tool } = setup({ web: { results: [
    { title: "Reciente", url: "https://ejemplo.mx/reciente", description: "Actual.", age: "1 day ago", page_age: "2026-09-06T10:00:00Z" },
    { title: "Antigua", url: "https://ejemplo.mx/antigua", description: "Vieja.", age: "1 year ago", page_age: "2025-01-01T10:00:00Z" },
    { title: "Sin fecha", url: "https://ejemplo.mx/sin-fecha", description: "Sin metadatos." },
  ] } });
  const output = await tool.execute({ query: "actualidad", period: "week" }, { runId: "r", agentId: "a", stepId: "s", userId: "u" });
  assert.deepEqual(output, { query: "actualidad", sources: [{ title: "Reciente", url: "https://ejemplo.mx/reciente", excerpt: "Actual.", age: "1 day ago", pageAge: "2026-09-06T10:00:00Z" }] });
});

test("Buscar en internet explica cuando el periodo no tiene fuentes verificables", async () => {
  const { tool } = setup({ web: { results: [{ title: "Sin fecha", url: "https://ejemplo.mx/sin-fecha" }] } });
  const output = await tool.execute({ query: "actualidad", period: "day" }, { runId: "r", agentId: "a", stepId: "s", userId: "u" });
  assert.deepEqual(output, { query: "actualidad", sources: [], note: "No encontramos fuentes con fecha verificable dentro del periodo solicitado." });
});

test("Buscar en internet rechaza entradas ambiguas y fechas inválidas antes de buscar", async () => {
  const { tool, requests } = setup({ web: { results: [] } });
  const context = { runId: "r", agentId: "a", stepId: "s", userId: "u" };
  for (const input of [null, { query: " " }, { query: "x", from: "2026-02-30", to: "2026-03-01" }, { query: "x", from: "2026-01-01" }, { query: "x", period: "week", from: "2026-01-01", to: "2026-01-02" }]) {
    await assert.rejects(tool.execute(input, context), /filtro de fecha válido/);
  }
  assert.equal(requests.length, 0);
});

test("Buscar en internet no filtra detalles del proveedor ante un fallo", async () => {
  const { tool } = setup({ message: "internal provider failure" }, 429);
  await assert.rejects(tool.execute({ query: "prueba" }, { runId: "r", agentId: "a", stepId: "s", userId: "u" }), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.message, "No pudimos consultar las fuentes web. Intenta de nuevo.");
    assert.doesNotMatch(error.message, /internal provider failure/);
    return true;
  });
});
