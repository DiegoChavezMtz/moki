"use client";
import Image from "next/image";
import Link from "next/link";
import { Fragment, useRef, useState, type DragEvent } from "react";
import logo from "../../../../../marca/MokiLogo2.png";
import { useBuilder } from "../../hooks/use-builder";
import type { DragPayload } from "../../utils/chain";
import { StepCard } from "../molecules/step-card";
import { Palette } from "./palette";
import { ChatPanel } from "./chat-panel";
import "../../builder.css";
export function Builder() {
  const state = useBuilder();
  const payload = useRef<DragPayload | null>(null);
  const [insertAt, setInsertAt] = useState<number | null>(null);
  function endDrag() { payload.current = null; setInsertAt(null); }
  function startDrag(value: DragPayload, event: DragEvent) {
    payload.current = value; event.dataTransfer.effectAllowed = value.kind === "new" ? "copy" : "move";
    event.dataTransfer.setData("text/plain", "moki-block");
  }
  function position(event: DragEvent) {
    const cards = [...event.currentTarget.querySelectorAll("[data-step-id]")];
    const index = cards.findIndex((card) => { const rect = card.getBoundingClientRect(); return event.clientY < rect.top + rect.height / 2; });
    return index < 0 ? cards.length : index;
  }
  return <div className="builder"><header className="topbar"><div className="topbar-left">
    <div className="builder-logo"><Image src={logo} alt="Moki by Dekids" priority sizes="130px" /></div>
    <div><h1>Constructor de agentes</h1><span className="step-count">{state.draft.steps.length} {state.draft.steps.length === 1 ? "bloque" : "bloques"} · {state.savedId ? "Agente guardado" : "Borrador sin guardar"}</span></div>
  </div><div className="topbar-actions"><button className="btn-secondary" onClick={state.newAgent} disabled={state.busy}>Nuevo agente</button><Link className="btn-secondary" href="/marketplace">Marketplace</Link><Link className="btn-secondary" href="/cuenta">Mi cuenta</Link><button className="btn-secondary" onClick={() => void state.refreshAgents()} disabled={state.busy}>Mis agentes</button><button className="btn-secondary" onClick={() => void state.save()} disabled={state.busy || !state.editable}>Guardar agente</button><button className="btn-primary" onClick={() => void state.test()} disabled={state.busy}>{state.busy ? "Recorriendo…" : "Probar agente"}</button><button className="btn-secondary" onClick={() => void state.signOut()} disabled={state.busy}>Cerrar sesión</button></div></header>
    {state.showAgents && <section className="saved-agents" aria-label="Mis agentes"><div><h2>Mis agentes</h2><button className="icon-btn" onClick={state.closeAgents} aria-label="Cerrar mis agentes">×</button></div>{state.agents.length ? <ul>{state.agents.map((agent) => <li key={agent.id}><button onClick={() => state.openAgent(agent)} disabled={state.busy}><strong>{agent.title}</strong><span>{agent.description}</span></button><button className="icon-btn" disabled={state.busy} onClick={() => void state.removeAgent(agent)} aria-label={`Eliminar ${agent.title}`}>×</button></li>)}</ul> : <p>Aún no has guardado agentes.</p>}</section>}
    <div className="agent-details"><div><label htmlFor="agent-title">Título <span>(obligatorio)</span></label><input id="agent-title" value={state.draft.title} disabled={state.busy || !state.editable} onChange={(event) => state.metadata("title", event.target.value)} placeholder="Dale un nombre a tu agente" required aria-invalid={!!state.errors.title} aria-describedby={state.errors.title ? "title-error" : undefined} />{state.errors.title && <p className="field-error" id="title-error">{state.errors.title}</p>}</div>
      <div><label htmlFor="agent-description">Descripción <span>(obligatoria)</span></label><input id="agent-description" value={state.draft.description} disabled={state.busy || !state.editable} onChange={(event) => state.metadata("description", event.target.value)} placeholder="¿Qué hace y para qué sirve?" required aria-invalid={!!state.errors.description} aria-describedby={state.errors.description ? "description-error" : undefined} />{state.errors.description && <p className="field-error" id="description-error">{state.errors.description}</p>}</div></div>
    <div className="builder-notice" role="status">{state.notice || "Prueba tu agente con una entrada real. Los borradores válidos se guardan antes de ejecutarse."}</div>
    <div className="builder-main"><Palette busy={state.busy || !state.editable} add={state.add} onDrag={(type, event) => startDrag({ kind: "new", type }, event)} onDragEnd={endDrag} />
      <main className="canvas-wrap" aria-label="Cadena de bloques" onDragOver={(event) => { if (!payload.current || state.busy) return; event.preventDefault(); event.dataTransfer.dropEffect = payload.current.kind === "new" ? "copy" : "move"; setInsertAt(position(event)); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setInsertAt(null); }} onDrop={(event) => {
        event.preventDefault(); const value = payload.current; if (!value || state.busy) return;
        const at = position(event); if (value.kind === "new") state.add(value.type, at); else state.move(value.id, at); endDrag();
      }}>
        <div className="canvas"><div className="chain">
          {!state.draft.steps.length && <div className={`empty-state ${insertAt !== null ? "drop-hover" : ""}`}><span className="empty-symbol" aria-hidden="true">＋</span><strong>Tu cadena empieza aquí</strong><p>Arrastra tu primer bloque o elige uno de la paleta.</p><small>Un paso a la vez.</small></div>}
          {state.draft.steps.map((step, index) => <Fragment key={step.id}>
            {index > 0 && <div className={`connector ${state.activeId === step.id ? "pulsing" : ""}`} aria-hidden="true" />}
            {insertAt === index && <div className="drop-indicator" />}
            <StepCard step={step} index={index} count={state.draft.steps.length} busy={state.busy || !state.editable} active={state.activeId === step.id} error={state.errors.steps[step.id]} onInstruction={(text) => state.instruction(step.id, text)} onMove={(at) => state.move(step.id, at)} onRemove={() => state.remove(step.id)} onDrag={(event) => startDrag({ kind: "move", id: step.id }, event)} onDragEnd={endDrag} file={state.documents.get(step.id)} onFile={(file) => state.document(step.id, file)} />
          </Fragment>)}
          {!!state.draft.steps.length && insertAt === state.draft.steps.length && <div className="drop-indicator" />}
        </div></div>
      </main><ChatPanel messages={state.messages} input={state.input} setInput={state.setInput} busy={state.busy} test={state.test} />
    </div>
  </div>;
}
