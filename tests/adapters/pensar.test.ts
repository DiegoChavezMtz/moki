import assert from "node:assert/strict";
import test from "node:test";
import { pensar } from "../../src/adapters/blocks/pensar.ts";

test("Pensar es un bloque de razonamiento sin herramienta y conserva su tipo de dominio", () => {
  assert.equal(pensar.manifest.type, "pensar");
  assert.equal(pensar.tool, undefined);
});
