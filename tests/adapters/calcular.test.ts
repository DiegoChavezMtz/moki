import { test } from "node:test";
import assert from "node:assert/strict";
import { calcular, calculate } from "../../src/adapters/blocks/calcular.ts";

test("Calcular resuelve operaciones con precedencia, paréntesis y decimales exactos", () => {
  assert.equal(calculate("2 + 3 * 4"), "14");
  assert.equal(calculate("(2 + 3) * 4"), "20");
  assert.equal(calculate("0.1 + 0.2"), "0.3");
  assert.equal(calculate("1 / 3"), "1/3");
  assert.equal(calculate("-5 + 2.5"), "-2.5");
});

test("Calcular entrega la operación y el resultado exacto como datos para el siguiente bloque", async () => {
  if (!calcular.tool) throw new Error("El bloque debe incluir herramienta.");
  assert.deepEqual(await calcular.tool.execute({ expression: "1250 * 0.16" }, { runId: "r", agentId: "a", stepId: "s", userId: "u" }), { expression: "1250 * 0.16", result: "200" });
  assert.equal(calcular.tool.schema.name, "hacer_un_calculo");
});

test("Calcular rechaza expresiones incompletas, texto y divisiones entre cero", () => {
  for (const expression of ["", "2 +", "texto", "1 / 0", "1,5 + 2", "(2 + 3"]) {
    assert.throws(() => calculate(expression), /No pudimos calcular/);
  }
});
