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
