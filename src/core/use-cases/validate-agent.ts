import { ValidationError, type ValidationIssue } from "../domain/errors.ts";
import { BLOCK_TYPES, type Agent } from "../domain/models.ts";

export function ValidateAgent(agent: Agent): void {
  const issues: ValidationIssue[] = [];
  for (const [field, label] of [["title", "título"], ["description", "descripción"]] as const) {
    if (!agent[field].trim()) issues.push({ field, message: `Agrega ${label} al agente.` });
  }
  if (!agent.steps.length) issues.push({ field: "steps", message: "Agrega un bloque antes de probar el agente." });
  const ids = new Set<string>();
  agent.steps.forEach((step, index) => {
    const field = `steps.${index}`;
    if (!step.id.trim() || ids.has(step.id)) {
      issues.push({ field, stepId: step.id, message: `El bloque ${index + 1} no tiene un identificador único.` });
    }
    ids.add(step.id);
    if (!BLOCK_TYPES.some((type) => type === step.blockType)) {
      issues.push({ field, stepId: step.id, message: `El bloque ${index + 1} no pertenece al catálogo disponible.` });
    }
    if (!step.instruction.trim()) {
      issues.push({ field, stepId: step.id, message: `Agrega instrucciones al bloque ${index + 1}.` });
    }
  });
  if (issues.length) throw new ValidationError(issues);
}
