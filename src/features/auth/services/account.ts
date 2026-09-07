export async function deleteAccount(): Promise<void> {
  const response = await fetch("/api/account", { method: "DELETE" });
  if (response.ok) return;
  const body: unknown = await response.json().catch(() => null);
  throw new Error(typeof body === "object" && body !== null && "error" in body && typeof body.error === "string" ? body.error : "No pudimos eliminar la cuenta.");
}
