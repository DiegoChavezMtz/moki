import { NextResponse } from "next/server";
import { SupabaseAgentRepository } from "../../../adapters/persistence/supabase-agent.ts";
import { createServerSupabaseClient } from "../../../adapters/persistence/server-client.ts";
import { ForbiddenError, NotFoundError, UnauthenticatedError, ValidationError } from "../../../core/domain/errors.ts";
import type { Agent, Step } from "../../../core/domain/models.ts";

type AgentInput = { id?: unknown; title?: unknown; description?: unknown; steps?: unknown };

export async function authenticatedAgents() {
  const client = await createServerSupabaseClient();
  const { data, error } = await client.auth.getClaims();
  const userId = data?.claims?.sub;
  return !error && userId ? { userId, repo: new SupabaseAgentRepository(client) } : null;
}

export function parseAgent(value: unknown, ownerId: string, fallbackId?: string): Agent | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const { id, title, description, steps } = value as AgentInput;
  const resolvedId = fallbackId ?? id;
  if (typeof resolvedId !== "string" || !resolvedId.trim() || typeof title !== "string" || typeof description !== "string" || !Array.isArray(steps)) return null;
  const parsedSteps: Step[] = [];
  for (const step of steps) {
    if (typeof step !== "object" || step === null || Array.isArray(step)) return null;
    const { id: stepId, blockType, instruction } = step as { id?: unknown; blockType?: unknown; instruction?: unknown };
    if (typeof stepId !== "string" || typeof blockType !== "string" || typeof instruction !== "string") return null;
    parsedSteps.push({ id: stepId, blockType, instruction });
  }
  return { id: resolvedId, ownerId, title, description, steps: parsedSteps };
}

export function failure(error: unknown) {
  if (error instanceof UnauthenticatedError) return NextResponse.json({ error: error.message }, { status: 401 });
  if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 });
  if (error instanceof NotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
  if (error instanceof ValidationError) return NextResponse.json({ error: error.message, issues: error.issues }, { status: 400 });
  return NextResponse.json({ error: "No pudimos completar la operación con el agente. Inténtalo de nuevo." }, { status: 500 });
}
