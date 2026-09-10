export class NotFoundError extends Error {
  constructor() { super("No encontramos este agente."); this.name = "NotFoundError"; }
}
export class ForbiddenError extends Error {
  constructor() { super("Solo quien creó este agente puede modificarlo o eliminarlo."); this.name = "ForbiddenError"; }
}
export class UnauthenticatedError extends Error {
  constructor() { super("Inicia sesión para continuar."); this.name = "UnauthenticatedError"; }
}
export type ValidationIssue = { field: string; message: string; stepId?: string };
export class ValidationError extends Error {
  readonly issues: ValidationIssue[];
  constructor(issues: ValidationIssue[]) {
    super(issues.map((issue) => issue.message).join(" "));
    this.name = "ValidationError";
    this.issues = issues;
  }
}

/** Mensajes públicos controlados; nunca contienen la respuesta ni secretos del proveedor. */
export class ModelLimitError extends Error {
  readonly code: "tokens" | "timeout";
  constructor(code: "tokens" | "timeout") {
    super(code === "tokens"
      ? "El modelo no terminó la respuesta porque alcanzó el límite de tokens. Simplifica la tarea de este bloque o solicita ampliar el límite de respuesta."
      : "El modelo agotó el tiempo de espera. Intenta de nuevo; si se repite, solicita ampliar el tiempo de espera.");
    this.name = "ModelLimitError";
    this.code = code;
  }
}

const BLOCK_RESPONSE_MESSAGES = {
  missing_tool: "El modelo respondió sin solicitar la herramienta obligatoria de este bloque.",
  multiple_tools: "El modelo solicitó varias herramientas; este bloque admite una sola llamada.",
  invalid_tool: "El modelo solicitó una herramienta que no corresponde a este bloque o una llamada inválida.",
  unexpected_tool: "El modelo intentó usar una herramienta cuando debía entregar la respuesta del bloque.",
  empty_response: "El modelo no devolvió una respuesta utilizable para este bloque.",
  invalid_response: "El modelo devolvió contenido incompatible con este bloque.",
  incomplete: "El modelo no terminó la respuesta del bloque.",
} as const;

export class BlockResponseError extends Error {
  readonly code: keyof typeof BLOCK_RESPONSE_MESSAGES;
  constructor(code: keyof typeof BLOCK_RESPONSE_MESSAGES) {
    super(BLOCK_RESPONSE_MESSAGES[code]); this.name = "BlockResponseError"; this.code = code;
  }
}
