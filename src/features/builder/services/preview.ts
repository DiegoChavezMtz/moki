import type { Step } from "../../../core/domain/models.ts";
import { catalog } from "../utils/chain.ts";
function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error("Cancelado")); return; }
    const abort = () => { clearTimeout(timer); reject(new Error("Cancelado")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}
/** Simulación visual del prototipo: sin red, sin LLM y sin ejecución del core. */
export async function previewChain(steps: Step[], onStep: (id: string | null) => void, signal: AbortSignal): Promise<string> {
  for (const step of steps) { onStep(step.id); await pause(420, signal); }
  onStep(null); await pause(500, signal);
  const labels = steps.map((step) => catalog.find((block) => block.type === step.blockType)?.label).join(" → ");
  return `Vista previa: ${labels}. Esta es una simulación visual; todavía no se ha ejecutado el agente ni generado una respuesta con IA.`;
}
