import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { AccountDeletionGateway } from "../../core/ports/contracts.ts";

type NewAccount = { email: string; password: string; name: string };

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("El registro directo todavía no está configurado.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export class SupabaseAccountRegistration {
  private readonly client;
  constructor() { this.client = adminClient(); }

  async createUser(input: NewAccount): Promise<{ id: string; email: string }> {
    const { data, error } = await this.client.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { name: input.name },
    });
    if (error) {
      if (error.code === "email_exists" || error.code === "user_already_exists") throw new Error("Ya existe una cuenta con ese correo.");
      throw new Error("No pudimos crear tu cuenta. Inténtalo de nuevo.");
    }
    if (!data.user) throw new Error("No pudimos crear tu cuenta. Inténtalo de nuevo.");
    return { id: data.user.id, email: data.user.email ?? input.email };
  }
}

export class SupabaseAccountDeletion implements AccountDeletionGateway {
  private readonly client;
  constructor() {
    this.client = adminClient();
  }
  async deleteUser(id: string): Promise<void> {
    const { error } = await this.client.auth.admin.deleteUser(id);
    if (error) throw new Error("No pudimos eliminar la cuenta.");
  }
}
