import type { Step } from "../../../core/domain/models.ts";
import { blockCatalog } from "../../../shared/utils/block-catalog.ts";

// Reexportado para no romper los consumidores propios del Constructor.
export const catalog = blockCatalog;
export type BlockType = typeof catalog[number]["type"];
export type Draft = { title: string; description: string; steps: Step[] };
export type DragPayload = { kind: "new"; type: BlockType } | { kind: "move"; id: string };
export type DraftErrors = { title?: string; description?: string; chain?: string; steps: Record<string, string> };
/** Ranura de inserción antes de retirar el bloque, como en el prototipo. */
export function moveStep(steps: Step[], id: string, atIndex: number): Step[] {
  const index = steps.findIndex((step) => step.id === id);
  if (index < 0) return steps;
  const next = [...steps]; const [step] = next.splice(index, 1);
  const slot = Math.max(0, Math.min(steps.length, atIndex));
  next.splice(slot > index ? slot - 1 : slot, 0, step);
  return next;
}
export function validateDraft(draft: Draft, mode: "save" | "test"): DraftErrors {
  const errors: DraftErrors = { steps: {} };
  if (mode === "save") {
    if (!draft.title.trim()) errors.title = "Agrega un título para guardar tu agente.";
    if (!draft.description.trim()) errors.description = "Describe qué hace tu agente antes de guardarlo.";
  }
  if (!draft.steps.length) errors.chain = mode === "save" ? "Agrega al menos un bloque para guardar tu agente." : "Agrega al menos un bloque para probar tu agente.";
  draft.steps.forEach((step, index) => {
    if (!step.instruction.trim()) errors.steps[step.id] = `Agrega instrucciones al bloque ${index + 1}.`;
  });
  return errors;
}
export function hasErrors(errors: DraftErrors) {
  return !!(errors.title || errors.description || errors.chain || Object.keys(errors.steps).length);
}
