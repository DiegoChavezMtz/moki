import { NextResponse } from "next/server";
import { ForkAgent } from "../../../../core/use-cases/fork-agent.ts";
import { failure } from "../../agents/shared.ts";
import { authenticatedMarketplace, presentMarketplaceAgents } from "../shared.ts";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Context) {
  const session = await authenticatedMarketplace();
  if (!session) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  try {
    const agent = await session.repo.get((await params).id);
    if (!agent) return NextResponse.json({ error: "No encontramos este agente." }, { status: 404 });
    const all = await session.repo.listAll();
    const presented = (await presentMarketplaceAgents(session.client, [...all.filter((item) => item.id !== agent.id), agent])).find((item) => item.id === agent.id);
    if (!presented) throw new Error("No pudimos preparar este agente.");
    return NextResponse.json({ agent: presented });
  } catch (error) { return failure(error); }
}

export async function POST(_: Request, { params }: Context) {
  const session = await authenticatedMarketplace();
  if (!session) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  try {
    const fork = await ForkAgent((await params).id, session.userId, session.repo, () => crypto.randomUUID());
    return NextResponse.json({ agent: fork }, { status: 201 });
  } catch (error) { return failure(error); }
}
