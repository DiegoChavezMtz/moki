import { NextResponse } from "next/server";
import { SaveAgent } from "../../../core/use-cases/save-agent.ts";
import { authenticatedAgents, failure, parseAgent } from "./shared.ts";

export async function GET() {
  const session = await authenticatedAgents();
  if (!session) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  try { return NextResponse.json({ agents: await session.repo.listByOwner(session.userId) }); }
  catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  const session = await authenticatedAgents();
  if (!session) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  try {
    const agent = parseAgent(await request.json(), session.userId);
    if (!agent) return NextResponse.json({ error: "Envía un agente válido." }, { status: 400 });
    await SaveAgent(agent, session.userId, session.repo);
    return NextResponse.json({ agent }, { status: 201 });
  } catch (error) { return failure(error); }
}
