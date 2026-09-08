"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { login, register, AuthServiceError } from "../../../shared/services/auth";
export type AuthMode = "login" | "register";
export function useAuthForm(mode: AuthMode) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const ready = true;
  const pending = useRef(false);
  async function submit() {
    if (pending.current || !ready) return;
    setError(""); setMessage("");
    pending.current = true; setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password); router.replace("/constructor"); return;
      } else {
        await register(name, email, password); setPassword(""); router.replace("/constructor"); return;
      }
    } catch (error) {
      setError(error instanceof AuthServiceError ? error.message : "No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.");
    } finally { pending.current = false; setBusy(false); }
  }
  return { email, setEmail, name, setName, password, setPassword, busy, message, error, ready, submit };
}
