"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { MarketplaceAgent } from "../../../../app/api/marketplace/shared.ts";
import { listMarketplace } from "../../services/marketplace.ts";
import "../../marketplace.css";

export function Marketplace() {
  const [agents, setAgents] = useState<MarketplaceAgent[]>([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; void listMarketplace().then((value) => { if (active) setAgents(value); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "No pudimos cargar el Marketplace."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  return <main className="marketplace"><header><div><p className="marketplace-eyebrow">Espacio compartido</p><h1>Marketplace</h1><p>Explora agentes creados por la comunidad, pruébalos o crea tu propia copia.</p></div><nav className="marketplace-nav" aria-label="Navegación del Marketplace"><Link href="/constructor" className="marketplace-back">Constructor</Link><Link href="/cuenta" className="marketplace-back">Mi cuenta</Link></nav></header>{loading ? <p role="status">Cargando agentes…</p> : error ? <p role="alert" className="marketplace-error">{error}</p> : agents.length ? <div className="marketplace-grid">{agents.map((agent) => <article key={agent.id} className="marketplace-card"><p className="marketplace-author">Creado por {agent.creatorName}</p><h2>{agent.title}</h2><p>{agent.description}</p><small>{agent.steps.length} {agent.steps.length === 1 ? "bloque" : "bloques"}</small>{agent.forkedFromAgent ? <p className="marketplace-fork">Creado a partir de {agent.forkedFromAgent.title}</p> : null}<Link href={`/marketplace/${agent.id}`}>Ver agente</Link></article>)}</div> : <section className="marketplace-empty"><h2>Aún no hay agentes para explorar.</h2><p>Crea el primero desde el Constructor.</p><Link href="/constructor">Crear agente</Link></section>}</main>;
}
