import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Conexión de infraestructura. La sesión por usuario se integra en el Sprint 4. */
export function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Falta configurar la URL y la clave publicable de Supabase en .env.local.");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
