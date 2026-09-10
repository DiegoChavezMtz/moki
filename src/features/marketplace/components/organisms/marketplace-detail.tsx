"use client";

import { TokenUsageDetails } from "../../../../shared/components/token-usage-details";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { MarketplaceAgent } from "../../../../app/api/marketplace/shared.ts";
import { MarkdownContent } from "../../../../shared/components/markdown-content";
import { currentUser } from "../../../../shared/services/auth.ts";
import { AgentRunError, runSavedAgent, type UsageCall, type SearchSource } from "../../../../shared/services/agent-run.ts";
import { blockCatalog } from "../../../../shared/utils/block-catalog.ts";
import { forkMarketplaceAgent, getMarketplaceAgent } from "../../services/marketplace.ts";
import logo from "../../../../../marca/MokiLogo2-transparente.png";
import "../../marketplace.css";

export function MarketplaceDetail({ agentId }: { agentId: string }) {
  const [agent, setAgent] = useState<MarketplaceAgent | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [documents, setDocuments] = useState<Map<string, File>>(new Map());
  const [output, setOutput] = useState("");
  const [usage, setUsage] = useState<UsageCall[] | null>(null);
  const [sources, setSources] = useState<SearchSource[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([getMarketplaceAgent(agentId), currentUser()])
      .then(([value, user]) => { if (active) { setAgent(value); setOwnerId(user?.id ?? null); } })
      .catch((reason) => { if (active) setNotice(reason instanceof Error ? reason.message : "No pudimos cargar este agente."); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [agentId]);

  function document(stepId: string, file: File | null) {
    setDocuments((current) => {
      const next = new Map(current);
      if (file) next.set(stepId, file); else next.delete(stepId);
      return next;
    });
  }

  async function run() {
    if (!agent || busy) return;
    const missing = agent.steps.find((step) => step.blockType === "leer-documento" && !documents.has(step.id));
    if (missing) { setNotice(`Carga un documento para el bloque ${agent.steps.indexOf(missing) + 1}.`); return; }
    setBusy(true); setNotice(""); setOutput(""); setSources([]); setUsage(null);
    try {
      const result = await runSavedAgent(agent.id, input.trim() || "Caso de prueba de ejemplo", documents);
      setOutput(result.output ?? "La ejecución no produjo una respuesta.");
      setSources(result.sources);
      setUsage(result.usage);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No pudimos ejecutar este agente.");
      if (error instanceof AgentRunError) setUsage(error.usage);
    } finally { setBusy(false); }
  }

  async function fork() {
    if (!agent || busy) return;
    setBusy(true); setNotice("");
    try {
      await forkMarketplaceAgent(agent.id);
      setNotice("Tu copia está lista en Mis agentes. Ábrela desde el Constructor para editarla.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No pudimos crear tu copia del agente.");
    } finally { setBusy(false); }
  }

  if (!agent) return <main className="marketplace marketplace-detail"><Link className="detail-back" href="/marketplace">← Volver al Marketplace</Link><p role="status">{notice || "Cargando agente…"}</p></main>;

  const own = agent.ownerId === ownerId;
  return <main className="marketplace marketplace-detail">
    <header className="detail-navigation">
      <div className="detail-navigation-start">
        <Link className="detail-brand" href="/" aria-label="Moki, inicio"><Image src={logo} alt="Moki by Dekids" priority sizes="96px" /></Link>
        <Link className="detail-back" href="/marketplace">← Explorar agentes</Link>
      </div>
      <Link className="detail-constructor-link" href="/constructor">Ir al Constructor <span aria-hidden="true">↗</span></Link>
    </header>

    <section className="agent-hero">
      <div className="agent-hero-copy">
        <p className="marketplace-eyebrow">Agente publicado</p>
        <h1>{agent.title}</h1>
        <p>{agent.description}</p>
        <div className="agent-meta"><span>Creado por <strong>{agent.creatorName}</strong></span><span>{agent.steps.length} {agent.steps.length === 1 ? "bloque" : "bloques"}</span>{agent.forkedFromAgent ? <span>Creado a partir de {agent.forkedFromAgent.title}</span> : null}</div>
      </div>
      <div className="agent-hero-action">
        <span>{own ? "Este agente es tuyo" : "Hazlo tuyo"}</span>
        {own ? <Link className="detail-primary-action" href="/constructor">Editar agente</Link> : <button className="detail-primary-action" onClick={() => void fork()} disabled={busy}>{busy ? "Creando copia…" : "Crear mi copia"}</button>}
      </div>
    </section>

    <div className="agent-detail-grid">
      <section className="agent-chain-card" aria-labelledby="chain-title">
        <div className="section-heading"><div><p className="marketplace-eyebrow">La cadena</p><h2 id="chain-title">Así trabaja este agente</h2></div><span>{agent.steps.length} pasos</span></div>
        <ol className="agent-chain">
          {agent.steps.map((step, index) => {
            const block = blockCatalog.find((item) => item.type === step.blockType);
            const finalResponse = step.blockType === "escribir" && index === agent.steps.length - 1;
            return <li key={step.id} className={finalResponse ? "agent-chain-final" : ""}>
              <span className="agent-chain-number">{index + 1}</span>
              <span className="agent-chain-icon" style={{ background: block?.color ?? "#6b6862" }} aria-hidden="true">{block?.icon ?? "•"}</span>
              <div><div className="agent-chain-title"><strong>{block?.label ?? step.blockType}</strong>{finalResponse ? <span>Salida final</span> : null}</div><p>{step.instruction}</p>{step.blockType === "leer-documento" ? <label className="detail-document-input">Documento para este paso<input type="file" accept=".pdf,.docx,.txt,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain" disabled={busy} onChange={(event) => document(step.id, event.target.files?.[0] ?? null)} />{documents.get(step.id) ? <small>{documents.get(step.id)?.name}</small> : <small>PDF, DOCX, TXT o XLSX · hasta 20 MB</small>}</label> : null}</div>
            </li>;
          })}
        </ol>
      </section>

      <section className="agent-run-card" aria-labelledby="run-title">
        <div className="section-heading"><div><p className="marketplace-eyebrow">Pruébalo ahora</p><h2 id="run-title">Dale un caso real</h2></div><span className="detail-live-badge">Ejecución real</span></div>
        <p className="agent-run-intro">Escribe lo que quieres resolver. El agente seguirá cada paso de la cadena y mostrará su respuesta aquí.</p>
        <label className="sr-only" htmlFor="marketplace-test-input">Caso de prueba</label>
        <textarea id="marketplace-test-input" value={input} onChange={(event) => setInput(event.target.value)} disabled={busy} placeholder="Por ejemplo: resume las noticias relevantes de esta semana…" />
        <button className="detail-run-button" onClick={() => void run()} disabled={busy}>{busy ? "Ejecutando agente…" : "Probar este agente"}<span aria-hidden="true">→</span></button>
        {notice ? <p role="status" className="detail-notice">{notice}</p> : null}
        {usage !== null ? <TokenUsageDetails calls={usage} /> : null}
        {output ? <article className="marketplace-output detail-output"><div className="detail-output-heading"><p className="marketplace-eyebrow">Resultado</p><h2>Respuesta del agente</h2></div><MarkdownContent content={output} />{sources.length ? <section><strong>Fuentes consultadas</strong><ul>{sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a><span>{source.pageAge ?? source.age ?? "Sin fecha verificable"}</span></li>)}</ul></section> : null}</article> : null}
      </section>
    </div>
  </main>;
}
