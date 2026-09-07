import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProfileRepository } from "../../core/ports/contracts.ts";
import type { Profile } from "../../core/domain/models.ts";

export class SupabaseProfileRepository implements ProfileRepository {
  constructor(private readonly client: SupabaseClient) {}

  async get(id: string): Promise<Profile | null> {
    const { data, error } = await this.client.from("profiles").select("id, name").eq("id", id).maybeSingle();
    if (error) throw new Error("No pudimos leer el perfil.");
    if (!data) return null;
    const { data: user } = await this.client.auth.getUser();
    return { id: data.id, name: data.name, email: user.user?.id === id ? user.user.email ?? "" : "" };
  }

  async update(id: string, data: Partial<Pick<Profile, "name">>): Promise<void> {
    if (data.name === undefined) return;
    const { error } = await this.client.from("profiles").update({ name: data.name }).eq("id", id);
    if (error) throw new Error("No pudimos actualizar el perfil.");
  }
}
