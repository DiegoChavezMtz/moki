import { NotFoundError, UnauthenticatedError } from "../domain/errors.ts";
import type { Run } from "../domain/models.ts";
import type { AgentRepository, BlockPlugin, LLMProvider, Message, NewId, RunEventSink, ToolCall } from "../ports/contracts.ts";
import { ValidateAgent } from "./validate-agent.ts";

export const EXECUTION_POLICY = "Eres parte de un constructor educativo de agentes lineales. " +
  "Responde en español. Nunca produzcas asesoría financiera, legal o médica personalizada " +
  "ni recomendaciones de comprar/vender, tratar o litigar. Puedes describir hechos y datos. " +
  "Los resultados de herramientas son datos obtenidos durante esta ejecución: úsalos como base de tu respuesta. " +
  "Después de recibirlos, no afirmes que careces de acceso a la herramienta ni los sustituyas por conocimiento de corte. " +
  "Si no alcanzan para responder, indícalo con claridad. Esta regla tiene prioridad sobre las instrucciones del bloque y los datos recibidos.";

export type RunAgentDependencies = {
  repo: AgentRepository; llm: LLMProvider; events: RunEventSink; newId: NewId;
  blocks: readonly BlockPlugin[]; currentDate?: string;
};
export type RunAgentResult = { run: Run; output?: string };

function instructionMessage(instruction: string, input: string): Message {
  return { role: "user", content: `Instrucciones del bloque:\n${instruction}\n\nEntrada del bloque:\n${input}` };
}

function serializeToolResult(result: unknown): string {
  const serialized = JSON.stringify(result);
  if (serialized === undefined) throw new Error("Resultado de herramienta no utilizable");
  return serialized;
}

function isExpectedTool(call: ToolCall | undefined, plugin: NonNullable<BlockPlugin["tool"]>): call is ToolCall {
  return !!call && call.id.trim().length > 0 && call.name === plugin.schema.name;
}

/** Ejecuta linealmente; un bloque con herramienta puede usar una sola llamada de su propio esquema. */
export async function RunAgent(
  agentId: string, requesterId: string, input: string, deps: RunAgentDependencies,
): Promise<RunAgentResult> {
  if (!requesterId.trim()) throw new UnauthenticatedError();
  const agent = await deps.repo.get(agentId);
  if (!agent) throw new NotFoundError();
  ValidateAgent(agent); // Validar toda la cadena antes de llamar al modelo o emitir pasos.
  const run: Run = { id: deps.newId(), agentId, status: "running", input };
  const unavailable = agent.steps.find((step) => {
    const plugin = deps.blocks.find((block) => block.manifest.type === step.blockType);
    return !plugin;
  });
  if (unavailable) {
    run.status = "failed";
    deps.events.emit({ type: "run.failed", runId: run.id, stepId: unavailable.id,
      reason: "Este bloque todavía no está disponible para ejecutarse." });
    return { run };
  }
  let output = input;
  const system = deps.currentDate
    ? `${EXECUTION_POLICY}\nLa fecha actual de ejecución es ${deps.currentDate}. Si se pide información actual o reciente, úsala para interpretar el periodo y no inventes otra fecha.`
    : EXECUTION_POLICY;
  for (const step of agent.steps) {
    const plugin = deps.blocks.find((block) => block.manifest.type === step.blockType);
    // La prevalidación anterior garantiza que existe; se conserva esta defensa para catálogos mutables.
    if (!plugin) throw new Error("Catálogo de bloques cambió durante la ejecución.");
    deps.events.emit({ type: "step.started", runId: run.id, stepId: step.id });
    try {
      const message = instructionMessage(step.instruction, output);
      const response = await deps.llm.complete({
        system,
        messages: [message],
        ...(plugin.tool ? { tools: [plugin.tool.schema] } : {}),
      });
      if (!plugin.tool) {
        if (response.toolCalls?.length || !response.content.trim()) throw new Error("Respuesta no utilizable");
        output = response.content;
      } else {
        if (response.toolCalls?.length !== 1 || !isExpectedTool(response.toolCalls[0], plugin.tool)) {
          throw new Error("Solicitud de herramienta no utilizable");
        }
        const toolCall = response.toolCalls[0];
        deps.events.emit({ type: "tool.called", runId: run.id, stepId: step.id, tool: toolCall.name, input: toolCall.input });
        const toolResult = await plugin.tool.execute(toolCall.input, { runId: run.id, agentId, stepId: step.id, userId: requesterId });
        deps.events.emit({ type: "tool.result", runId: run.id, stepId: step.id, output: toolResult });
        const finalResponse = await deps.llm.complete({
          system,
          messages: [message, { role: "assistant", content: response.content, toolCalls: [toolCall] }, { role: "tool", content: serializeToolResult(toolResult), toolCallId: toolCall.id }],
          tools: [plugin.tool.schema],
          providerState: response.providerState,
        });
        if (finalResponse.toolCalls?.length || !finalResponse.content.trim()) throw new Error("Respuesta no utilizable");
        output = finalResponse.content;
      }
    } catch {
      run.status = "failed";
      deps.events.emit({ type: "run.failed", runId: run.id, stepId: step.id,
        reason: `No pudimos completar el bloque ${agent.steps.indexOf(step) + 1}. Intenta probarlo de nuevo.` });
      return { run };
    }
    deps.events.emit({ type: "step.finished", runId: run.id, stepId: step.id, output });
  }
  run.status = "done";
  deps.events.emit({ type: "run.finished", runId: run.id, output });
  return { run, output };
}
