import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { AccountDeletionGateway } from "../../core/ports/contracts.ts";

export class SupabaseAccountDeletion implements AccountDeletionGateway {
  private readonly client;
  constructor() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!url || !key) throw new Error("La baja de cuenta todavía no está configurada.");
    this.client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  }
  async deleteUser(id: string): Promise<void> {
    const { error } = await this.client.auth.admin.deleteUser(id);
    if (error) throw new Error("No pudimos eliminar la cuenta.");
  }
}
