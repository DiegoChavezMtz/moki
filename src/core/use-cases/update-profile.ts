import type { ProfileRepository } from "../ports/contracts.ts";

export async function UpdateProfile(id: string, name: string, profiles: ProfileRepository): Promise<void> {
  if (!id.trim()) throw new Error("Sesión no válida.");
  if (name.length > 120) throw new Error("El nombre visible no puede superar 120 caracteres.");
  await profiles.update(id, { name: name.trim() });
}
