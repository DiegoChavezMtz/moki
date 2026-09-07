import { NextResponse } from "next/server";
import { SupabaseAccountDeletion } from "../../../adapters/persistence/supabase-account.ts";
import { SupabaseAgentRepository } from "../../../adapters/persistence/supabase-agent.ts";
import { createServerSupabaseClient } from "../../../adapters/persistence/server-client.ts";
import { DeleteAccount } from "../../../core/use-cases/delete-account.ts";

export async function DELETE() {
  const client = await createServerSupabaseClient();
  const { data, error } = await client.auth.getClaims(); const userId = data?.claims?.sub;
  if (error || !userId) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  try { await DeleteAccount(userId, new SupabaseAgentRepository(client), new SupabaseAccountDeletion()); return new NextResponse(null, { status: 204 }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No pudimos eliminar la cuenta." }, { status: 500 }); }
}
