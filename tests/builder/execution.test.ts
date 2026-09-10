import assert from "node:assert/strict";
import test from "node:test";
import { saveAndRunAgent } from "../../src/features/builder/services/execution.ts";

const editedDraft = {
  id: "agent-1",
  title: "Análisis actualizado",
  description: "Usa la instrucción más reciente.",
  steps: [{ id: "step-1", blockType: "escribir", instruction: "Responde con la versión editada." }],
};

test("probar guarda la edición actual antes de ejecutar y usa el id persistido", async () => {
  const calls: string[] = [];
  const result = await saveAndRunAgent(editedDraft, true, "Caso real", new Map(), {
    save: async (agent, exists) => {
      calls.push("save");
      assert.equal(exists, true);
      assert.deepEqual(agent, editedDraft);
      return { ...agent, id: "agent-persisted", ownerId: "owner-1" };
    },
    run: async (id, input) => {
      calls.push("run");
      assert.equal(id, "agent-persisted");
      assert.equal(input, "Caso real");
      return { output: "Respuesta con la edición actual.", sources: [] };
    },
  });
  assert.deepEqual(calls, ["save", "run"]);
  assert.equal(result.result.output, "Respuesta con la edición actual.");
});

test("probar un agente nuevo lo crea antes de ejecutar", async () => {
  const calls: string[] = [];
  await saveAndRunAgent(editedDraft, false, "Caso nuevo", new Map(), {
    save: async (agent, exists) => { calls.push("save"); assert.equal(exists, false); return { ...agent, ownerId: "owner-1" }; },
    run: async () => { calls.push("run"); return { output: "Listo", sources: [] }; },
  });
  assert.deepEqual(calls, ["save", "run"]);
});

test("un fallo de guardado impide ejecutar una versión anterior", async () => {
  let executed = false;
  await assert.rejects(saveAndRunAgent(editedDraft, true, "Caso", new Map(), {
    save: async () => { throw new Error("No se pudo guardar"); },
    run: async () => { executed = true; return { output: "No debe ocurrir", sources: [] }; },
  }), /No se pudo guardar/);
  assert.equal(executed, false);
});
