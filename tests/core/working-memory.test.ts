import test from "node:test";
import assert from "node:assert/strict";
import { WorkingMemory } from "../../src/core/use-cases/working-memory.ts";

test("memoria pequeña no consume llamadas adicionales", async () => {
  const memory = new WorkingMemory(); memory.remember(1, "pensar", "Hallazgo");
  await memory.compact(async () => { throw new Error("No debe llamarse"); }, "Objetivo");
  assert.match(memory.context(), /Hallazgo/);
});

for (const result of [new Error("proveedor secreto"), { content: "" }, { content: "x".repeat(7000) }]) {
  test(`resumen fallido o inválido conserva fragmentos con omisión explícita: ${result instanceof Error ? "error" : result.content.length}`, async () => {
    const memory = new WorkingMemory(); memory.remember(1, "pensar", "Principio " + "x".repeat(13000) + " Final");
    await memory.compact(async () => { if (result instanceof Error) throw result; return result; }, "Objetivo");
    assert.ok(memory.context().length < 6000);
    assert.match(memory.context(), /Principio/); assert.match(memory.context(), /Final/);
    assert.match(memory.context(), /Fragmentos omitidos/); assert.doesNotMatch(memory.context(), /proveedor secreto/);
  });
}

test("el resumen recibe fuentes originales separadas de interpretaciones", async () => {
  const memory = new WorkingMemory();
  memory.remember(1, "buscar-web", "Interpretación " + "x".repeat(13000), [{ url: "https://ejemplo.mx/informe", pageAge: "2026-09-10" }]);
  await memory.compact(async (request) => {
    assert.match(request.messages[0].content, /https:\/\/ejemplo.mx\/informe/);
    assert.match(request.messages[0].content, /requieren verificación/);
    assert.match(request.system, /No inventes datos ni conviertas interpretaciones/);
    return { content: "Hallazgos: pendientes. Fuentes: https://ejemplo.mx/informe (2026-09-10)." };
  }, "Bimbo");
  assert.match(memory.context(), /https:\/\/ejemplo.mx\/informe/);
});
