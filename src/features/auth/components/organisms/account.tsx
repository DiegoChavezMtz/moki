"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { currentUser, logout, AuthServiceError, type AuthUser } from "../../../../shared/services/auth";
import { getProfile, updateProfile } from "../../services/profile";
import { deleteAccount } from "../../services/account";
export function Account() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [confirmDeletion, setConfirmDeletion] = useState(false);
  useEffect(() => {
    let active = true;
    async function load() {
      try { const value = await currentUser(); if (active) { setUser(value); if (value) setName((await getProfile()).name); } }
      catch (error) { if (active) setError(error instanceof AuthServiceError ? error.message : "No pudimos verificar tu sesión."); }
      finally { if (active) setLoading(false); }
    }
    void load(); return () => { active = false; };
  }, []);
  async function signOut() {
    setBusy(true); setError("");
    try { await logout(); router.replace("/login"); return; }
    catch { setError("No pudimos cerrar la sesión. Inténtalo de nuevo."); }
    finally { setBusy(false); }
  }
  async function saveProfile() {
    setBusy(true); setError("");
    try { const profile = await updateProfile(name); setName(profile.name); }
    catch (error) { setError(error instanceof Error ? error.message : "No pudimos actualizar tu perfil."); }
    finally { setBusy(false); }
  }
  async function removeAccount() {
    setBusy(true); setError("");
    try { await deleteAccount(); await logout(); router.replace("/login"); }
    catch (error) { setError(error instanceof Error ? error.message : "No pudimos eliminar la cuenta."); }
    finally { setBusy(false); }
  }
  return <><h1>Mi cuenta</h1>{loading ? <p role="status">Comprobando sesión…</p> : user ? <><p className="auth-subtitle">{user.email}</p><label className="auth-field">Nombre visible<input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} disabled={busy} /></label><button className="auth-submit" disabled={busy} onClick={() => void saveProfile()}>{busy ? "Un momento…" : "Guardar nombre"}</button><button className="auth-submit" disabled={busy} onClick={() => void signOut()}>{busy ? "Un momento…" : "Cerrar sesión"}</button><hr /><p className="auth-subtitle">Eliminar tu cuenta borrará tus agentes. Los forks de otras personas se conservarán.</p>{confirmDeletion ? <><button className="auth-submit" disabled={busy} onClick={() => void removeAccount()}>{busy ? "Eliminando…" : "Sí, eliminar mi cuenta definitivamente"}</button><button className="auth-submit" disabled={busy} onClick={() => setConfirmDeletion(false)}>Cancelar</button></> : <button className="auth-submit auth-danger" disabled={busy} onClick={() => setConfirmDeletion(true)}>Eliminar cuenta</button>}</> : <p className="auth-subtitle">Inicia sesión para acceder a tu cuenta.</p>}
    {error && <p className="auth-error" role="alert" >{error}</p>}<nav className="auth-links">{user ? <Link href="/constructor">Volver al Constructor</Link> : <Link href="/login">Iniciar sesión</Link>}</nav></>;
}
