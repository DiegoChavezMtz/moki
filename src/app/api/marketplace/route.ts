import { NextResponse } from "next/server";
import { failure } from "../agents/shared.ts";
import { authenticatedMarketplace, presentMarketplaceAgents } from "./shared.ts";

export async function GET() {
  const session = await authenticatedMarketplace();
  if (!session) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  try {
    const agents = await session.repo.listAll();
    return NextResponse.json({ agents: await presentMarketplaceAgents(session.client, agents) });
  } catch (error) { return failure(error); }
}
