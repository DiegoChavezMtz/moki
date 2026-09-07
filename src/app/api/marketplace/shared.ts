import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseAgentRepository } from "../../../adapters/persistence/supabase-agent.ts";
import { createServerSupabaseClient } from "../../../adapters/persistence/server-client.ts";
import type { Agent } from "../../../core/domain/models.ts";

export type MarketplaceAgent = Agent & { creatorName: string; forkedFromAgent?: { title: string } };
type ProfileRow = { id: string; name: string };

export async function authenticatedMarketplace() {
  const client = await createServerSupabaseClient();
  const { data, error } = await client.auth.getClaims(); const userId = data?.claims?.sub;
  return !error && userId ? { client, userId, repo: new SupabaseAgentRepository(client) } : null;
}

async function profiles(client: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const { data, error } = await client.from("profiles").select("id,name").in("id", ids);
  if (error) throw new Error("No pudimos cargar las personas creadoras.");
  return new Map(((data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile.name.trim() || "Persona de Moki"]));
}

export async function presentMarketplaceAgents(client: SupabaseClient, agents: Agent[]): Promise<MarketplaceAgent[]> {
  const names = await profiles(client, [...new Set(agents.map((agent) => agent.ownerId))]);
  const byId = new Map(agents.map((agent) => [agent.id, agent]));
  return agents.map((agent) => {
    const original = agent.forkedFrom ? byId.get(agent.forkedFrom) : undefined;
    return {
      ...agent,
      creatorName: names.get(agent.ownerId) ?? "Persona de Moki",
      ...(agent.forkedFrom ? { forkedFromAgent: { title: original?.title ?? "un agente eliminado" } } : {}),
    };
  });
}
