import { NextResponse } from "next/server";
import { SupabaseProfileRepository } from "../../../adapters/persistence/supabase-profile.ts";
import { createServerSupabaseClient } from "../../../adapters/persistence/server-client.ts";
import { UpdateProfile } from "../../../core/use-cases/update-profile.ts";

async function authenticatedProfile() {
  const client = await createServerSupabaseClient();
  const { data, error } = await client.auth.getClaims();
  const userId = data?.claims?.sub;
  return !error && userId ? { userId, profiles: new SupabaseProfileRepository(client) } : null;
}

export async function GET() {
  const session = await authenticatedProfile();
  if (!session) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  const profile = await session.profiles.get(session.userId);
  return NextResponse.json({ profile });
}

export async function PATCH(request: Request) {
  const session = await authenticatedProfile();
  if (!session) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body) || typeof (body as { name?: unknown }).name !== "string") throw new Error("Incluye un nombre visible válido.");
    await UpdateProfile(session.userId, (body as { name: string }).name, session.profiles);
    const profile = await session.profiles.get(session.userId);
    return NextResponse.json({ profile });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("120") ? error.message : "No pudimos actualizar tu perfil. Inténtalo de nuevo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
