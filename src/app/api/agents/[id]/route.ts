import { NextResponse } from "next/server";
import { DeleteAgent } from "../../../../core/use-cases/delete-agent.ts";
import { SaveAgent } from "../../../../core/use-cases/save-agent.ts";
import { authenticatedAgents, failure, parseAgent } from "../shared.ts";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Context) {
  const session = await authenticatedAgents();
  if (!session) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  try {
    const agent = await session.repo.get((await params).id);
    return agent ? NextResponse.json({ agent }) : NextResponse.json({ error: "No encontramos este agente." }, { status: 404 });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request, { params }: Context) {
  const session = await authenticatedAgents();
  if (!session) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  try {
    const agent = parseAgent(await request.json(), session.userId, (await params).id);
    if (!agent) return NextResponse.json({ error: "Envía un agente válido." }, { status: 400 });
    await SaveAgent(agent, session.userId, session.repo);
    return NextResponse.json({ agent });
  } catch (error) { return failure(error); }
}

export async function DELETE(_: Request, { params }: Context) {
  const session = await authenticatedAgents();
  if (!session) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  try { await DeleteAgent((await params).id, session.userId, session.repo); return new NextResponse(null, { status: 204 }); }
  catch (error) { return failure(error); }
}
