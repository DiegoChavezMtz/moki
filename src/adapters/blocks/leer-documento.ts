import "server-only";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import * as XLSX from "xlsx";
import type { BlockPlugin, ExecutionContext } from "../../core/ports/contracts.ts";

export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
export const MAX_PDF_PAGES = 100;

export type DocumentFormat = "pdf" | "docx" | "txt" | "xlsx";
export type ExecutionDocument = { name: string; contentType: string; bytes: Uint8Array };
export type ReadDocumentResult = { name: string; format: DocumentFormat; text: string; pages?: number; sheets?: number };
export type ExecutionDocumentSource = { load(context: ExecutionContext): Promise<ExecutionDocument> };

type PdfExtractor = (bytes: Uint8Array) => Promise<{ pages: number; text: string }>;
type DocxExtractor = (bytes: Uint8Array) => Promise<string>;
type XlsxExtractor = (bytes: Uint8Array) => Promise<{ sheets: number; text: string }>;
export type DocumentReaderDependencies = { extractPdf?: PdfExtractor; extractDocx?: DocxExtractor; extractXlsx?: XlsxExtractor };

class DocumentReadError extends Error {}

function documentError(): never {
  throw new DocumentReadError("No pudimos leer este documento. Usa un archivo PDF, DOCX, TXT o XLSX de hasta 20 MB.");
}

function pdfPageError(): never {
  throw new DocumentReadError("El PDF supera el límite de 100 páginas.");
}

function formatFromName(name: string): DocumentFormat {
  const extension = name.trim().toLowerCase().split(".").pop();
  if (extension === "pdf" || extension === "docx" || extension === "txt" || extension === "xlsx") return extension;
  return documentError();
}

function validateDocument(document: ExecutionDocument): DocumentFormat {
  if (!document || typeof document.name !== "string" || !document.name.trim() || !(document.bytes instanceof Uint8Array)) documentError();
  if (document.bytes.byteLength === 0 || document.bytes.byteLength > MAX_DOCUMENT_BYTES) documentError();
  return formatFromName(document.name);
}

async function extractPdf(bytes: Uint8Array): Promise<{ pages: number; text: string }> {
  const pdf = await getDocumentProxy(bytes);
  try {
    if (pdf.numPages > MAX_PDF_PAGES) pdfPageError();
    const result = await extractText(pdf, { mergePages: true });
    return { pages: result.totalPages, text: result.text };
  } finally {
    await pdf.cleanup();
  }
}

async function extractDocx(bytes: Uint8Array): Promise<string> {
  const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return result.value;
}

function extractTxt(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

async function extractXlsx(bytes: Uint8Array): Promise<{ sheets: number; text: string }> {
  const workbook = XLSX.read(bytes, { type: "array" });
  if (!workbook.SheetNames.length) documentError();
  const text = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const contents = sheet ? XLSX.utils.sheet_to_csv(sheet, { blankrows: false }) : "";
    return `Hoja: ${sheetName}\n${contents || "(sin datos)"}`;
  }).join("\n\n");
  return { sheets: workbook.SheetNames.length, text };
}

/** Lee solo contenido de texto; no realiza OCR de archivos escaneados. */
export async function readExecutionDocument(document: ExecutionDocument, dependencies: DocumentReaderDependencies = {}): Promise<ReadDocumentResult> {
  const format = validateDocument(document);
  try {
    if (format === "pdf") {
      const result = await (dependencies.extractPdf ?? extractPdf)(document.bytes);
      if (!Number.isInteger(result.pages) || result.pages < 1) documentError();
      if (result.pages > MAX_PDF_PAGES) pdfPageError();
      return { name: document.name, format, pages: result.pages, text: result.text };
    }
    if (format === "docx") return { name: document.name, format, text: await (dependencies.extractDocx ?? extractDocx)(document.bytes) };
    if (format === "xlsx") {
      const result = await (dependencies.extractXlsx ?? extractXlsx)(document.bytes);
      if (!Number.isInteger(result.sheets) || result.sheets < 1) documentError();
      return { name: document.name, format, sheets: result.sheets, text: result.text };
    }
    return { name: document.name, format, text: extractTxt(document.bytes) };
  } catch (error) {
    if (error instanceof DocumentReadError) throw error;
    documentError();
  }
}

function validateToolInput(input: unknown): void {
  if (typeof input !== "object" || input === null || Array.isArray(input) || Object.keys(input).length !== 0) {
    throw new Error("La herramienta de documento no acepta parámetros.");
  }
}

/** El archivo viene de la persona que ejecuta y se resuelve por el ID del paso, nunca desde el modelo. */
export function createLeerDocumento(source: ExecutionDocumentSource, dependencies: DocumentReaderDependencies = {}): BlockPlugin {
  return {
    manifest: {
      type: "leer-documento",
      label: "Leer un documento",
      color: "#7657D9",
      icon: "document",
      placeholder: "Indica qué información necesitas extraer del archivo que se solicitará al ejecutar.",
    },
    tool: {
      schema: {
        name: "leer_documento_cargado",
        description: "Lee el archivo que la persona cargó específicamente para este bloque. No solicita rutas ni nombres de archivo.",
        inputSchema: { type: "object", additionalProperties: false, properties: {} },
      },
      async execute(input, context) {
        validateToolInput(input);
        return readExecutionDocument(await source.load(context), dependencies);
      },
    },
  };
}
