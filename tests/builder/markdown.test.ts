import assert from "node:assert/strict";
import test from "node:test";
import { normalizeMarkdown } from "../../src/shared/utils/markdown.ts";

test("normaliza sintaxis Markdown escapada por el modelo sin alterar texto normal", () => {
  assert.equal(normalizeMarkdown("\\# Título\\n\\*\\*dato\\*\\* y \\~valor"), "# Título\\n**dato** y ~valor");
  assert.equal(normalizeMarkdown("Ruta C:\\documentos"), "Ruta C:\\documentos");
});
