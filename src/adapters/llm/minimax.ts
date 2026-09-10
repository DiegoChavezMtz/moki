import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { BlockResponseError, ModelLimitError } from "../../core/domain/errors.ts";
import type { LLMProvider, LLMRequest, LLMResponse } from "../../core/ports/contracts.ts";

export const MINIMAX_ANTHROPIC_BASE_URL = "https://api.minimax.io/anthropic";
export type MiniMaxConfig = { apiKey: string; model: string; maxTokens?: number; timeoutMs?: number };

function positiveInteger(value: unknown, fallback: number, name: string): number {
  if (value === undefined || value === "") return fallback;
  const parsed = typeof value === "string" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Configuración inválida: ${name} debe ser un entero positivo.`);
  }
  return parsed;
}

export function readMiniMaxConfig(): MiniMaxConfig {
  const apiKey = process.env.MINIMAX_API_KEY?.trim();
  const model = process.env.MINIMAX_MODEL?.trim();
  if (!apiKey || !model) throw new Error("Falta configurar MiniMax en el servidor.");
  return { apiKey, model, maxTokens: positiveInteger(process.env.MINIMAX_MAX_TOKENS, 8192, "MINIMAX_MAX_TOKENS"), timeoutMs: positiveInteger(process.env.MINIMAX_TIMEOUT_MS, 120_000, "MINIMAX_TIMEOUT_MS") };
}

/** Adaptador MiniMax mediante su API compatible con Anthropic. El core no conoce este transporte. */
export class MiniMaxLLM implements LLMProvider {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(config: MiniMaxConfig, client?: Anthropic) {
    if (!config.apiKey.trim() || !config.model.trim()) throw new Error("Configuración de MiniMax incompleta.");
    this.model = config.model;
    this.maxTokens = positiveInteger(config.maxTokens, 8192, "maxTokens");
    const timeout = positiveInteger(config.timeoutMs, 120_000, "timeoutMs");
    this.client = client ?? new Anthropic({
      apiKey: config.apiKey,
      baseURL: MINIMAX_ANTHROPIC_BASE_URL,
      timeout,
      maxRetries: 0,
    });
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    if (request.outputSchema !== undefined) throw new Error("Este adaptador todavía no admite salida estructurada.");
    if (request.requiredTool && (request.providerState !== undefined || !request.tools?.some((tool) => tool.name === request.requiredTool))) {
      throw new Error("La herramienta requerida no está disponible para esta llamada.");
    }
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
      max_tokens: this.maxTokens,
      system: request.system,
      messages,
      // Tras devolver el resultado de una herramienta, v1 exige texto final: no se
      // reenvían herramientas para impedir una segunda llamada del modelo.
      ...(request.providerState === undefined && request.tools?.length ? { tools: request.tools.map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.inputSchema as Anthropic.Tool.InputSchema })) } : {}),
      ...(request.requiredTool ? { tool_choice: { type: "tool" as const, name: request.requiredTool, disable_parallel_tool_use: true } } : {}),
    }).catch((error: unknown) => {
      if (error instanceof Anthropic.APIConnectionTimeoutError) throw new ModelLimitError("timeout");
      throw error;
    });
    const usage = response.usage;
    const validCount = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
    request.onUsage?.(usage && validCount(usage.input_tokens) && validCount(usage.output_tokens)
      && [usage.cache_creation_input_tokens, usage.cache_read_input_tokens].every((value) => value == null || validCount(value))
      ? { inputTokens: usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0), outputTokens: usage.output_tokens }
      : null);
    if (response.stop_reason === "max_tokens") throw new ModelLimitError("tokens");
    if (response.stop_reason !== "end_turn" && response.stop_reason !== "refusal" && response.stop_reason !== "tool_use") {
      throw new BlockResponseError("incomplete");
    }
    if (response.content.some((block) => block.type !== "text" && block.type !== "thinking" && block.type !== "tool_use")) {
      throw new BlockResponseError("invalid_response");
    }
    // MiniMax puede incluir razonamiento firmado; nunca se expone y no es salida del bloque.
    const content = response.content.filter((block) => block.type === "text").map((block) => block.text).join("\n");
    const toolCalls = response.content.filter((block) => block.type === "tool_use").map((block) => ({ id: block.id, name: block.name, input: block.input }));
    if (!content.trim() && !toolCalls.length) throw new BlockResponseError("empty_response");
    return { content, ...(toolCalls.length ? { toolCalls, providerState: response.content } : {}) };
  }
}
