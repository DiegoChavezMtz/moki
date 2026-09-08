import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import logo from "../../../../../marca/MokiLogo2-transparente.png";
import "../../auth.css";
export function AuthShell({ children }: { children: ReactNode }) {
  return <main className="auth-page">
    <header className="auth-header">
      <Link className="auth-logo" href="/" aria-label="Moki, inicio"><Image src={logo} alt="Moki by Dekids" priority sizes="130px" /></Link>
      <Link className="auth-home" href="/">Inicio <span aria-hidden="true">↗</span></Link>
    </header>
    <div className="auth-layout">
      <section className="auth-intro" aria-label="Acerca de Moki">
        <p className="auth-kicker">Constructor de agentes</p>
        <h2>Convierte una tarea en una cadena clara.</h2>
        <p>Define los pasos que necesita tu agente y pruébalo con un caso real, todo desde el mismo lugar.</p>
        <ul className="auth-intro-points"><li>Arma tu flujo paso a paso</li><li>Usa búsqueda, documentos y cálculos</li><li>Guarda y comparte tus agentes</li></ul>
      </section>
      <section className="auth-card">{children}</section>
    </div>
    <p className="auth-footer">Una idea. Un paso a la vez.</p>
  </main>;
}
