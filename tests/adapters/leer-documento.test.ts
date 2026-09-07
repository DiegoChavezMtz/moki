import { test } from "node:test";
import assert from "node:assert/strict";
import { createLeerDocumento, MAX_DOCUMENT_BYTES, MAX_PDF_PAGES, readExecutionDocument } from "../../src/adapters/blocks/leer-documento.ts";
import { createStoredDocumentSource, executionDocumentPath, withExecutionDocumentCleanup, type ExecutionDocumentStorage, type StoredExecutionDocument } from "../../src/adapters/persistence/execution-documents.ts";

const encoder = new TextEncoder();
const context = { runId: "run-1", agentId: "agent-1", stepId: "step-1", userId: "user-1" };

function onePagePdf(text: string): Uint8Array {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(encoder.encode(pdf).byteLength);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = encoder.encode(pdf).byteLength;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${offset.toString().padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return encoder.encode(pdf);
}

test("Leer documento extrae TXT UTF-8 y conserva datos útiles para el siguiente bloque", async () => {
  const output = await readExecutionDocument({ name: "notas.txt", contentType: "text/plain", bytes: encoder.encode("Información útil: México.") });
  assert.deepEqual(output, { name: "notas.txt", format: "txt", text: "Información útil: México." });
});

test("Leer documento extrae texto de un PDF real", async () => {
  const output = await readExecutionDocument({ name: "real.pdf", contentType: "application/pdf", bytes: onePagePdf("Hola Moki") });
  assert.equal(output.format, "pdf");
  assert.equal(output.pages, 1);
  assert.match(output.text, /Hola Moki/);
});

test("Leer documento acepta PDF de hasta 100 páginas y DOCX mediante extractores aislados", async () => {
  const pdf = await readExecutionDocument(
    { name: "informe.pdf", contentType: "application/pdf", bytes: new Uint8Array([1]) },
    { extractPdf: async () => ({ pages: MAX_PDF_PAGES, text: "Texto del PDF" }) },
  );
  assert.deepEqual(pdf, { name: "informe.pdf", format: "pdf", pages: MAX_PDF_PAGES, text: "Texto del PDF" });
  const docx = await readExecutionDocument(
    { name: "informe.docx", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", bytes: new Uint8Array([1]) },
    { extractDocx: async () => "Texto del DOCX" },
  );
  assert.deepEqual(docx, { name: "informe.docx", format: "docx", text: "Texto del DOCX" });
});

test("Leer documento rechaza formatos, tamaño y PDFs que exceden el límite", async () => {
  await assert.rejects(readExecutionDocument({ name: "archivo.csv", contentType: "text/csv", bytes: new Uint8Array([1]) }), /PDF, DOCX o TXT/);
  await assert.rejects(readExecutionDocument({ name: "vacio.txt", contentType: "text/plain", bytes: new Uint8Array() }), /PDF, DOCX o TXT/);
  await assert.rejects(readExecutionDocument({ name: "grande.txt", contentType: "text/plain", bytes: new Uint8Array(MAX_DOCUMENT_BYTES + 1) }), /PDF, DOCX o TXT/);
  await assert.rejects(
    readExecutionDocument({ name: "largo.pdf", contentType: "application/pdf", bytes: new Uint8Array([1]) }, { extractPdf: async () => ({ pages: MAX_PDF_PAGES + 1, text: "" }) }),
    /100 páginas/,
  );
});

test("Cada bloque recibe únicamente su propio archivo ya cargado", async () => {
  const reference: StoredExecutionDocument = { path: executionDocumentPath(context, "uno.txt"), name: "uno.txt", contentType: "text/plain", userId: context.userId, runId: context.runId, stepId: context.stepId };
  const storage: ExecutionDocumentStorage = {
    download: async (received, receivedContext) => {
      assert.equal(received, reference);
      assert.deepEqual(receivedContext, context);
      return { name: "uno.txt", contentType: "text/plain", bytes: encoder.encode("archivo del paso") };
    },
    remove: async () => {},
  };
  const block = createLeerDocumento(createStoredDocumentSource(storage, new Map([[context.stepId, reference]])));
  if (!block.tool) throw new Error("El bloque debe incluir herramienta.");
  assert.deepEqual(await block.tool.execute({}, context), { name: "uno.txt", format: "txt", text: "archivo del paso" });
  await assert.rejects(block.tool.execute({ path: "ajeno.pdf" }, context), /no acepta parámetros/);
});

test("Las rutas aíslan usuario, ejecución y paso, y los archivos se eliminan incluso ante un fallo", async () => {
  assert.equal(executionDocumentPath(context, "reporte final.pdf"), "user-1/run-1/step-1/reporte%20final.pdf");
  const reference: StoredExecutionDocument = { path: "user-1/run-1/step-1/a.txt", name: "a.txt", contentType: "text/plain", userId: "user-1", runId: "run-1", stepId: "step-1" };
  let removed: readonly StoredExecutionDocument[] | undefined;
  const storage: ExecutionDocumentStorage = {
    download: async () => ({ name: "a.txt", contentType: "text/plain", bytes: encoder.encode("a") }),
    remove: async (documents) => { removed = documents; },
  };
  await assert.rejects(withExecutionDocumentCleanup(storage, [reference], async () => { throw new Error("falló la cadena"); }), /falló la cadena/);
  assert.deepEqual(removed, [reference]);
});
