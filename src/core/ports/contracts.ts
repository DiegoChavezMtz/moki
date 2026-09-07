import type { Agent, Profile, RunEvent } from "../domain/models.ts";

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type JsonSchema = boolean | { [keyword: string]: JsonValue };
export type ToolSchema = { name: string; description: string; inputSchema: JsonSchema };
export type ToolCall = { id: string; name: string; input: unknown };
export type Message =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: ToolCall[] }
  | { role: "tool"; content: string; toolCallId: string };
/** providerState es opaco para el core; permite que adaptadores con continuidad firmada reanuden herramientas. */
export type LLMResponse = { content: string; toolCalls?: ToolCall[]; providerState?: unknown };
export type LLMRequest = { system: string; messages: Message[]; tools?: ToolSchema[]; outputSchema?: JsonSchema; providerState?: unknown };
export interface LLMProvider { complete(req: LLMRequest): Promise<LLMResponse>; }
export type ExecutionContext = { runId: string; agentId: string; stepId: string; userId: string };
export interface BlockPlugin {
  manifest: { type: string; label: string; color: string; icon: string; placeholder: string };
  tool?: { schema: ToolSchema; execute(input: unknown, ctx: ExecutionContext): Promise<unknown> };
}
export interface AgentRepository {
  save(agent: Agent): Promise<void>;
  get(id: string): Promise<Agent | null>;
  listAll(): Promise<Agent[]>;
  listByOwner(ownerId: string): Promise<Agent[]>;
  delete(id: string): Promise<void>;
}
export interface ProfileRepository {
  get(id: string): Promise<Profile | null>;
  update(id: string, data: Partial<Pick<Profile, "name">>): Promise<void>;
}
export interface AccountDeletionGateway { deleteUser(id: string): Promise<void>; }
/** El receptor entrega eventos sin lanzar errores; el transporte vive fuera del core. */
export interface RunEventSink { emit(event: RunEvent): void; }
/** Identificadores nuevos y únicos, provistos desde fuera del dominio. */
export type NewId = () => string;
// Reserva de contrato únicamente. No hay cadencias ni scheduler habilitados en v1.
export type Cadence = never;
export interface TriggerScheduler {
  schedule(agentId: string, cadence: Cadence): Promise<void>;
  cancel(agentId: string): Promise<void>;
}
