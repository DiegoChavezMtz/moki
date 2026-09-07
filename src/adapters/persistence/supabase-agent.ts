import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { copyAgent, type Agent } from "../../core/domain/models.ts";
import type { AgentRepository } from "../../core/ports/contracts.ts";

type AgentRow = { id: string; owner_id: string; title: string; description: string; forked_from: string | null; steps: StepRow[] | null };
type StepRow = { id: string; block_type: string; instruction: string; position: number };

function fromRow(row: AgentRow): Agent {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description,
    ...(row.forked_from ? { forkedFrom: row.forked_from } : {}),
    steps: (row.steps ?? []).sort((a, b) => a.position - b.position).map(({ id, block_type, instruction }) => ({ id, blockType: block_type, instruction })),
  };
}

/** Persistencia de agentes mediante RLS y la RPC atómica definida en 0004_steps.sql. */
export class SupabaseAgentRepository implements AgentRepository {
  constructor(private readonly client: SupabaseClient) {}

  async save(agent: Agent): Promise<void> {
    const { error } = await this.client.rpc("moki_save_agent", {
      p_id: agent.id,
      p_title: agent.title,
      p_description: agent.description,
      p_steps: agent.steps.map((step) => ({ id: step.id, blockType: step.blockType, instruction: step.instruction })),
      p_forked_from: agent.forkedFrom ?? null,
    });
    if (error) throw new Error("No pudimos guardar el agente.");
  }

  async get(id: string): Promise<Agent | null> {
    const { data, error } = await this.client.from("agents").select("id,owner_id,title,description,forked_from,steps(id,block_type,instruction,position)").eq("id", id).maybeSingle();
    if (error) throw new Error("No pudimos consultar el agente.");
    return data ? fromRow(data as AgentRow) : null;
  }

  async listAll(): Promise<Agent[]> {
    const { data, error } = await this.client.from("agents").select("id,owner_id,title,description,forked_from,steps(id,block_type,instruction,position)");
    if (error) throw new Error("No pudimos cargar los agentes.");
    return (data as AgentRow[] ?? []).map(fromRow).map(copyAgent);
  }

  async listByOwner(ownerId: string): Promise<Agent[]> {
    const { data, error } = await this.client.from("agents").select("id,owner_id,title,description,forked_from,steps(id,block_type,instruction,position)").eq("owner_id", ownerId);
    if (error) throw new Error("No pudimos cargar los agentes.");
    return (data as AgentRow[] ?? []).map(fromRow).map(copyAgent);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client.from("agents").delete().eq("id", id);
    if (error) throw new Error("No pudimos eliminar el agente.");
  }
}
