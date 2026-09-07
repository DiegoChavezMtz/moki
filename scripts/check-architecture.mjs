import assert from "node:assert/strict";
import { ESLint } from "eslint";

const eslint = new ESLint();
const filePath = "src/core/domain/architecture-probe.ts";
const forbidden = [
  ...["adapters", "app", "shared", "features"].flatMap((layer) => [
    `import "@/${layer}/example";`,
    `import "../../${layer}/example";`,
    `export { example } from "@/${layer}/example";`,
  ]),
  'import "@supabase/supabase-js";',
  'import "react";',
  'import "node:fs";',
  'const dependency = import("@/adapters/example"); void dependency;',
  'const dependency = require("../../adapters/example"); void dependency;',
];

for (const code of forbidden) {
  const [result] = await eslint.lintText(code, { filePath });
  assert.ok(result.messages.some(({ ruleId }) =>
    ["no-restricted-imports", "no-restricted-syntax"].includes(ruleId)
  ), `La frontera dejó pasar: ${code}`);
}

for (const code of ['import "@/core/ports/example";', 'import "../ports/example";']) {
  const [result] = await eslint.lintText(code, { filePath });
  assert.equal(result.errorCount, 0, JSON.stringify(result.messages));
}

const [adapter] = await eslint.lintText('import "@supabase/supabase-js";', {
  filePath: "src/adapters/persistence/probe.ts",
});
assert.equal(adapter.errorCount, 0, JSON.stringify(adapter.messages));
console.log(`Frontera del core verificada: ${forbidden.length} imports prohibidos y 3 casos permitidos.`);
