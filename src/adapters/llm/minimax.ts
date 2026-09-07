import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider, LLMRequest, LLMResponse } from "../../core/ports/contracts.ts";

export const MINIMAX_ANTHROPIC_BASE_URL = "https://api.minimax.io/anthropic";
export type MiniMaxConfig = { apiKey: string; model: string };

export function readMiniMaxConfig(): MiniMaxConfig {
  const apiKey = process.env.MINIMAX_API_KEY?.trim();
  const model = process.env.MINIMAX_MODEL?.trim();
  if (!apiKey || !model) throw new Error("Falta configurar MiniMax en el servidor.");
  return { apiKey, model };
}

/** Adaptador MiniMax mediante su API compatible con Anthropic. El core no conoce este transporte. */
export class MiniMaxLLM implements LLMProvider {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(config: MiniMaxConfig, client?: Anthropic) {
    if (!config.apiKey.trim() || !config.model.trim()) throw new Error("Configuración de MiniMax incompleta.");
    this.model = config.model;
    this.client = client ?? new Anthropic({
      apiKey: config.apiKey,
      baseURL: MINIMAX_ANTHROPIC_BASE_URL,
      timeout: 30_000,
      maxRetries: 0,
    });
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    if (request.outputSchema !== undefined) throw new Error("Este adaptador todavía no admite salida estructurada.");
    const messages: Anthropic.MessageParam[] = request.messages.map((message, index) => {
      if (message.role === "assistant" && request.providerState !== undefined) {
        if (index !== request.messages.length - 2 || !Array.isArray(request.providerState)) throw new Error("Estado de continuidad no utilizable.");
        return { role: "assistant", content: request.providerState as Anthropic.ContentBlockParam[] };
      }
      if (message.role === "tool") {
        if (request.providerState === undefined) throw new Error("Este adaptador necesita el estado de continuidad para usar herramientas.");
        return { role: "user", content: [{ type: "tool_result", tool_use_id: message.toolCallId, content: message.content }] };
      }
      if (message.role === "assistant" && message.toolCalls?.length) {
        throw new Error("Este adaptador necesita el estado de continuidad para usar herramientas.");
      }
      return { role: message.role, content: message.content };
    });
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      system: request.system,
      messages,
      // Tras devolver el resultado de una herramienta, v1 exige texto final: no se
      // reenvían herramientas para impedir una segunda llamada del modelo.
      ...(request.providerState === undefined && request.tools?.length ? { tools: request.tools.map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.inputSchema as Anthropic.Tool.InputSchema })) } : {}),
    });
    if (response.stop_reason !== "end_turn" && response.stop_reason !== "refusal" && response.stop_reason !== "tool_use") {
      throw new Error("El modelo no terminó la respuesta.");
    }
    if (response.content.some((block) => block.type !== "text" && block.type !== "thinking" && block.type !== "tool_use")) {
      throw new Error("El modelo devolvió contenido no compatible con este bloque.");
    }
    // MiniMax puede incluir razonamiento firmado; nunca se expone y no es salida del bloque.
    const content = response.content.filter((block) => block.type === "text").map((block) => block.text).join("\n");
    const toolCalls = response.content.filter((block) => block.type === "tool_use").map((block) => ({ id: block.id, name: block.name, input: block.input }));
    if (!content.trim() && !toolCalls.length) throw new Error("El modelo no devolvió una respuesta.");
    return { content, ...(toolCalls.length ? { toolCalls, providerState: response.content } : {}) };
  }
}
