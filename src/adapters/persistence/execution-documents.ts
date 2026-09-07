import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExecutionContext } from "../../core/ports/contracts.ts";
import { MAX_DOCUMENT_BYTES, type ExecutionDocument, type ExecutionDocumentSource } from "../blocks/leer-documento.ts";

export const EXECUTION_DOCUMENTS_BUCKET = "execution-documents";

export type StoredExecutionDocument = {
  path: string;
  name: string;
  contentType: string;
  userId: string;
  runId: string;
  stepId: string;
};

export type ExecutionDocumentStorage = {
  download(reference: StoredExecutionDocument, context: ExecutionContext): Promise<ExecutionDocument>;
  remove(references: readonly StoredExecutionDocument[]): Promise<void>;
};

function storageError(): never {
  throw new Error("No pudimos preparar el documento para esta ejecución. Intenta cargarlo de nuevo.");
}

function safeFileName(name: string): string {
  const trimmed = name.normalize("NFKC").trim();
  if (!trimmed || trimmed.length > 255) storageError();
  return encodeURIComponent(trimmed);
}

function hasSameContext(reference: StoredExecutionDocument, context: ExecutionContext): boolean {
  return reference.userId === context.userId && reference.runId === context.runId && reference.stepId === context.stepId;
}

export function executionDocumentPath(context: ExecutionContext, name: string): string {
  if (!context.userId || !context.runId || !context.stepId) storageError();
  return `${context.userId}/${context.runId}/${context.stepId}/${safeFileName(name)}`;
}

/** Adaptador de Storage: la sesión autenticada que se inyecte debe pertenecer a context.userId. */
export function createExecutionDocumentStorage(client: SupabaseClient): ExecutionDocumentStorage & {
  upload(document: ExecutionDocument, context: ExecutionContext): Promise<StoredExecutionDocument>;
} {
  return {
    async upload(document, context) {
      if (!document.name || document.bytes.byteLength === 0 || document.bytes.byteLength > MAX_DOCUMENT_BYTES) storageError();
      const path = executionDocumentPath(context, document.name);
      const { error } = await client.storage.from(EXECUTION_DOCUMENTS_BUCKET).upload(path, document.bytes, {
        contentType: document.contentType,
        upsert: false,
      });
      if (error) storageError();
      return { path, name: document.name, contentType: document.contentType, userId: context.userId, runId: context.runId, stepId: context.stepId };
    },
    async download(reference, context) {
      if (!hasSameContext(reference, context)) storageError();
      const { data, error } = await client.storage.from(EXECUTION_DOCUMENTS_BUCKET).download(reference.path);
      if (error || !data) storageError();
      return { name: reference.name, contentType: reference.contentType, bytes: new Uint8Array(await data.arrayBuffer()) };
    },
    async remove(references) {
      if (references.length === 0) return;
      const { error } = await client.storage.from(EXECUTION_DOCUMENTS_BUCKET).remove(references.map((reference) => reference.path));
      if (error) storageError();
    },
  };
}

/** Vincula exactamente un archivo previamente cargado con cada paso Leer documento de una ejecución. */
export function createStoredDocumentSource(storage: ExecutionDocumentStorage, documents: ReadonlyMap<string, StoredExecutionDocument>): ExecutionDocumentSource {
  return {
    async load(context) {
      const reference = documents.get(context.stepId);
      if (!reference) storageError();
      return storage.download(reference, context);
    },
  };
}

/** La eliminación vive fuera del core y se ejecuta tanto tras éxito como tras fallo de la cadena. */
export async function withExecutionDocumentCleanup<T>(storage: ExecutionDocumentStorage, documents: readonly StoredExecutionDocument[], operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } finally {
    await storage.remove(documents);
  }
}
