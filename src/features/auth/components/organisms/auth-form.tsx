"use client";
import Link from "next/link";
import { useAuthForm, type AuthMode } from "../../hooks/use-auth-form";
import { AuthField } from "../molecules/auth-field";
const copy = {
  login: { title: "Qué gusto verte", subtitle: "Entra a tu cuenta de Moki.", button: "Iniciar sesión" },
  register: { title: "Crea tu cuenta", subtitle: "Empieza a construir tus agentes paso a paso.", button: "Crear cuenta" },
  recover: { title: "Recupera tu acceso", subtitle: "Te enviaremos un enlace para elegir otra contraseña.", button: "Enviar enlace" },
  password: { title: "Tu nueva contraseña", subtitle: "Elige una contraseña que solo tú conozcas.", button: "Cambiar contraseña" },
};
export function AuthForm({ mode }: { mode: AuthMode }) {
  const state = useAuthForm(mode); const text = copy[mode];
  return <><h1>{text.title}</h1><p className="auth-subtitle">{text.subtitle}</p>
    <form action={mode === "login" ? "/api/auth/login" : undefined} method={mode === "login" ? "post" : undefined} onSubmit={(event) => { event.preventDefault(); void state.submit(); }}>
      {mode !== "password" && <AuthField id="auth-email" name="email" label="Correo electrónico" type="email" autoComplete="email" required value={state.email} onChange={(event) => state.setEmail(event.target.value)} disabled={state.busy} />}
      {mode === "register" && <AuthField id="auth-name" label="Nombre visible (opcional)" type="text" autoComplete="name" value={state.name} onChange={(event) => state.setName(event.target.value)} disabled={state.busy} />}
      {mode !== "recover" && <AuthField id="auth-password" name="password" label={mode === "password" ? "Nueva contraseña" : "Contraseña"} type="password" autoComplete={mode === "password" || mode === "register" ? "new-password" : "current-password"} required value={state.password} onChange={(event) => state.setPassword(event.target.value)} disabled={state.busy} />}
      {mode === "password" && <AuthField id="auth-confirmation" label="Repite la nueva contraseña" type="password" autoComplete="new-password" required value={state.confirmation} onChange={(event) => state.setConfirmation(event.target.value)} disabled={state.busy} />}
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      {state.message && <p className="auth-message" role="status">{state.message}</p>}
      <button className="auth-submit" disabled={state.busy || !state.ready}>{state.busy ? "Un momento…" : text.button}</button>
    </form>
    <nav className="auth-links" aria-label="Opciones de cuenta">{mode === "login" ? <><Link href="/registro">Crear cuenta</Link><Link href="/recuperar-contrasena">Olvidé mi contraseña</Link></> : <Link href="/login">Volver a iniciar sesión</Link>}{state.message && mode !== "recover" && <Link href="/cuenta">Mi cuenta</Link>}</nav>
  </>;
}
