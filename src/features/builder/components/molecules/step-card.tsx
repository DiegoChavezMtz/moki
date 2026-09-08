import type { CSSProperties, DragEvent } from "react";
import type { Step } from "../../../../core/domain/models.ts";
import { catalog } from "../../utils/chain.ts";
import { BlockIcon } from "../atoms/block-icon";
type Props = { step: Step; index: number; count: number; busy: boolean; active: boolean; error?: string;
  onInstruction: (value: string) => void; onMove: (at: number) => void; onRemove: () => void;
  onDrag: (event: DragEvent) => void; onDragEnd: () => void };
export function StepCard({ step, index, count, busy, active, error, onInstruction, onMove, onRemove, onDrag, onDragEnd, file, onFile }: Props & { file?: File; onFile?: (file: File | null) => void }) {
  const block = catalog.find((block) => block.type === step.blockType)!;
  const finalResponse = step.blockType === "escribir" && index === count - 1;
  return <article className={`step-card ${active ? "active-pulse" : ""} ${error ? "invalid" : ""} ${finalResponse ? "final-response" : ""}`} data-step-id={step.id} style={{ "--step-color": block.color } as CSSProperties} aria-label={`Bloque ${index + 1}: ${block.label}${finalResponse ? ", salida final" : ""}`}>
    <div className="step-left"><BlockIcon {...block} />
      <button className="drag-handle" disabled={busy} draggable={!busy} onDragStart={onDrag} onDragEnd={onDragEnd} title="Arrastra para reordenar" aria-label={`Arrastrar bloque ${index + 1}`}>⠿</button>
      <button className="icon-btn" disabled={busy || index === 0} onClick={() => onMove(index - 1)} aria-label={`Mover bloque ${index + 1} arriba`}>↑</button>
      <button className="icon-btn" disabled={busy || index === count - 1} onClick={() => onMove(index + 2)} aria-label={`Mover bloque ${index + 1} abajo`}>↓</button>
    </div>
    <div className="step-body"><div className="step-head"><span className="step-type-label">{index + 1}. {block.label}</span>{finalResponse ? <span className="final-response-badge" aria-hidden="true">Salida final</span> : null}<button className="icon-btn" disabled={busy} onClick={onRemove} aria-label={`Eliminar bloque ${index + 1}`}>×</button></div>
      <label className="sr-only" htmlFor={`instruction-${step.id}`}>Instrucciones del bloque {index + 1}</label>
      <textarea id={`instruction-${step.id}`} className="step-instruction" value={step.instruction} disabled={busy} onChange={(event) => onInstruction(event.target.value)} placeholder={block.placeholder} aria-invalid={!!error} aria-describedby={error ? `error-${step.id}` : undefined} />
      {step.blockType === "leer-documento" && <label className="document-input">Documento para este bloque<input type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" disabled={busy} onChange={(event) => onFile?.(event.target.files?.[0] ?? null)} />{file && <small>{file.name}</small>}</label>}
      {error && <p id={`error-${step.id}`} className="field-error">{error}</p>}
    </div>
  </article>;
}
