import test from "node:test";
import assert from "node:assert/strict";
import { usageFromEvents, AgentRunError, runSavedAgent } from "../../src/shared/services/agent-run.ts";

const event = { type: "model.usage", stepId: "s", stepNumber: 1, purpose: "block", usage: { inputTokens: 20, outputTokens: 10 } };
test("lee consumo reportado y distingue datos ausentes o inválidos", () => {
  const calls = usageFromEvents([event, { ...event, usage: null }, { ...event, usage: { inputTokens: -1, outputTokens: 5 } }, { ...event, stepNumber: 0 }]);
  assert.equal(calls.length, 3); assert.deepEqual(calls[0].usage, event.usage);
  assert.equal(calls[1].usage, null); assert.equal(calls[2].usage, null);
});

test("conserva consumo en errores de ejecución para mostrarlo en los detalles", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ run: { status: "failed" }, events: [event, { type: "run.failed", reason: "Límite alcanzado" }] });
  try {
    await assert.rejects(runSavedAgent("a", "Bimbo", new Map()), (error: unknown) => {
      assert.ok(error instanceof AgentRunError); assert.equal(error.usage[0].usage?.inputTokens, 20); return true;
    });
  } finally { globalThis.fetch = previous; }
});
