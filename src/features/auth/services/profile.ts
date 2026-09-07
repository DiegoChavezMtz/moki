export type VisibleProfile = { id: string; name: string; email: string };

async function request(path: string, init?: RequestInit): Promise<VisibleProfile> {
  const response = await fetch(path, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  const body = await response.json() as { profile?: VisibleProfile; error?: string };
  if (!response.ok || !body.profile) throw new Error(body.error ?? "No pudimos actualizar tu perfil.");
  return body.profile;
}

export const getProfile = () => request("/api/profile");
export const updateProfile = (name: string) => request("/api/profile", { method: "PATCH", body: JSON.stringify({ name }) });
