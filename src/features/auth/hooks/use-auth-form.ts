"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { changePassword, currentUser, login, recoverPassword, register, AuthServiceError } from "../../../shared/services/auth";
export type AuthMode = "login" | "register" | "recover" | "password";
export function useAuthForm(mode: AuthMode) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(mode !== "password");
  const pending = useRef(false);
  useEffect(() => {
    if (mode !== "password") return;
    let mounted = true;
    async function check() {
      try {
        const user = await currentUser();
        if (mounted) {
          setReady(!!user);
          if (!user) setError("Abre el enlace de recuperación que recibiste por correo o inicia sesión.");
        }
      } catch (error) {
        if (mounted) setError(error instanceof AuthServiceError ? error.message : "No pudimos verificar tu sesión. Solicita otro enlace de recuperación.");
      }
    }
    void check(); return () => { mounted = false; };
  }, [mode]);
  async function submit() {
    if (pending.current || !ready) return;
    setError(""); setMessage("");
    if (mode === "password" && password !== confirmation) { setError("Las contraseñas no coinciden."); return; }
    pending.current = true; setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password); router.replace("/constructor"); return;
      } else if (mode === "register") {
        const result = await register(name, email, password); setPassword("");
        if (!result.confirmationRequired) { router.replace("/constructor"); return; }
        setMessage("Revisa tu correo para confirmar tu cuenta antes de iniciar sesión.");
      } else if (mode === "recover") {
        await recoverPassword(email); setMessage("Si el correo corresponde a una cuenta, recibirás un enlace para recuperar tu contraseña.");
      } else {
        await changePassword(password); router.replace("/cuenta"); return;
      }
    } catch (error) {
      setError(error instanceof AuthServiceError ? error.message : "No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.");
    } finally { pending.current = false; setBusy(false); }
  }
  return { email, setEmail, name, setName, password, setPassword, confirmation, setConfirmation, busy, message, error, ready, submit };
}
