import { test } from "node:test";
import assert from "node:assert/strict";
import { catalog, moveStep, validateDraft, hasErrors } from "../../src/features/builder/utils/chain.ts";
import { previewChain } from "../../src/features/builder/services/preview.ts";
const steps = ["a", "b", "c"].map((id) => ({ id, blockType: "escribir", instruction: `Instrucción ${id}` }));
test("las ranuras de arrastre mueven arriba, abajo y al final sin perder texto", () => {
  assert.deepEqual(moveStep(steps, "a", 3).map((s) => s.id), ["b", "c", "a"]);
  assert.deepEqual(moveStep(steps, "c", 0).map((s) => s.id), ["c", "a", "b"]);
  assert.deepEqual(moveStep(steps, "b", 2), steps);
  assert.deepEqual(moveStep(steps, "a", 3)[2], steps[0]);
  assert.equal(steps[0].id, "a");
});
test("guardar exige ambos campos y probar exige instrucciones en toda la cadena", () => {
  const draft = { title: " ", description: " ", steps };
  assert.ok(hasErrors(validateDraft(draft, "save")));
  assert.ok(validateDraft(draft, "save").title);
  assert.ok(validateDraft(draft, "save").description);
  assert.ok(!hasErrors(validateDraft({ ...draft, title: "Título", description: "Descripción" }, "save")));
  const invalid = validateDraft({ ...draft, steps: [...steps, { ...steps[0], id: "d", instruction: " " }] }, "test");
  assert.equal(invalid.steps.d, "Agrega instrucciones al bloque 4.");
  assert.ok(validateDraft({ ...draft, steps: [] }, "test").chain);
});
test("cada bloque disponible explica en lenguaje simple para qué sirve", () => {
  assert.equal(catalog.length, 5);
  assert.ok(catalog.every((block) => block.description.length > 20));
});
test("el pulso recorre en orden y la respuesta declara la simulación", async () => {
  const events: (string | null)[] = [];
  const result = await previewChain(steps.slice(0, 2), (id) => events.push(id), new AbortController().signal);
  assert.deepEqual(events, ["a", "b", null]);
  assert.match(result, /simulación visual/);
  assert.match(result, /no se ha ejecutado/);
});
test("desmontar cancela el recorrido sin avanzar al siguiente bloque", async () => {
  const controller = new AbortController(); const events: (string | null)[] = [];
  const pending = previewChain(steps, (id) => events.push(id), controller.signal);
  controller.abort(); await assert.rejects(pending, /Cancelado/);
  assert.deepEqual(events, ["a"]);
});
