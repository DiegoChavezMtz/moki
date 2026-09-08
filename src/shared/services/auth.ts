import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AuthUser = { id: string; email: string };
type AuthGateway = Pick<SupabaseClient["auth"], "signUp" | "signInWithPassword" | "signOut" | "getUser">;

export class AuthServiceError extends Error {
  constructor(message: string) { super(message); this.name = "AuthServiceError"; }
}

function failure(error: { code?: string; status?: number } | null): void {
  if (!error) return;
  const messages: Record<string, string> = {
    invalid_credentials: "El correo o la contraseña no son correctos.",
    email_not_confirmed: "Confirma tu correo antes de iniciar sesión.",
    weak_password: "Esta contraseña no cumple los requisitos de seguridad. Elige una más larga y difícil de adivinar.",
    same_password: "Elige una contraseña diferente a la anterior.",
    session_not_found: "Tu sesión terminó. Inicia sesión de nuevo.",
    over_email_send_rate_limit: "Espera unos minutos antes de solicitar otro correo.",
    over_request_rate_limit: "Hay demasiados intentos. Espera unos minutos y vuelve a intentar.",
    reauthentication_needed: "Inicia sesión de nuevo antes de cambiar tu contraseña.",
  };
  throw new AuthServiceError(messages[error.code ?? ""] ?? "No pudimos completar la solicitud. Inténtalo de nuevo.");
}

/** Autenticación fuera del core; esta parte no consulta public.profiles. */
export function createAuthService(auth: AuthGateway) {
  return {
    async register(name: string, email: string, password: string): Promise<AuthUser> {
      const { data, error } = await auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() } } });
      failure(error);
      if (!data.user || !data.session) throw new AuthServiceError("El registro directo todavía no está configurado. Inténtalo más tarde.");
      return { id: data.user.id, email: data.user.email ?? "" };
    },
    async login(email: string, password: string): Promise<AuthUser> {
      const { data, error } = await auth.signInWithPassword({ email: email.trim(), password });
      failure(error);
      if (!data.user) throw new AuthServiceError("No pudimos iniciar sesión.");
      return { id: data.user.id, email: data.user.email ?? "" };
    },
    async logout(): Promise<void> {
      const { error } = await auth.signOut({ scope: "local" }); failure(error);
    },
    async currentUser(): Promise<AuthUser | null> {
      const { data, error } = await auth.getUser();
      if (error && (error.name === "AuthSessionMissingError" || error.code === "session_not_found")) return null;
      failure(error);
      return data.user ? { id: data.user.id, email: data.user.email ?? "" } : null;
    },
  };
}

let service: ReturnType<typeof createAuthService> | undefined;
function authService() {
  if (typeof window === "undefined") throw new AuthServiceError("Esta operación requiere el navegador.");
  if (!service) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new AuthServiceError("El acceso a cuentas todavía no está configurado. Inténtalo más tarde.");
    service = createAuthService(createBrowserClient(url, key).auth);
  }
  return service;
}

export const login = (email: string, password: string) => authService().login(email, password);
export const register = (name: string, email: string, password: string) => authService().register(name, email, password);
export const logout = () => authService().logout();
export const currentUser = () => authService().currentUser();
