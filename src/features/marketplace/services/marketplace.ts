import type { MarketplaceAgent } from "../../../app/api/marketplace/shared.ts";

function message(body: unknown, fallback: string): string {
  return typeof body === "object" && body !== null && "error" in body && typeof body.error === "string" ? body.error : fallback;
}

export async function listMarketplace(): Promise<MarketplaceAgent[]> {
  const response = await fetch("/api/marketplace"); const body: unknown = await response.json().catch(() => null);
  if (!response.ok || typeof body !== "object" || body === null || !("agents" in body) || !Array.isArray(body.agents)) throw new Error(message(body, "No pudimos cargar el Marketplace."));
  return body.agents as MarketplaceAgent[];
}

export async function getMarketplaceAgent(id: string): Promise<MarketplaceAgent> {
  const response = await fetch(`/api/marketplace/${id}`); const body: unknown = await response.json().catch(() => null);
  if (!response.ok || typeof body !== "object" || body === null || !("agent" in body)) throw new Error(message(body, "No pudimos cargar este agente."));
  return body.agent as MarketplaceAgent;
}

export async function forkMarketplaceAgent(id: string): Promise<void> {
  const response = await fetch(`/api/marketplace/${id}`, { method: "POST" }); const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(message(body, "No pudimos crear el fork."));
}
