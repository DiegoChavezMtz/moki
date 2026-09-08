import type { DragEvent } from "react";
import { catalog, type BlockType } from "../../utils/chain.ts";
import { BlockIcon } from "../atoms/block-icon";
export function Palette({ busy, add, onDrag, onDragEnd }: { busy: boolean; add: (type: BlockType) => void; onDrag: (type: BlockType, event: DragEvent) => void; onDragEnd: () => void }) {
  return <aside className="palette" aria-label="Bloques disponibles"><h2>Bloques disponibles</h2>
    <div className="palette-list">{catalog.map((block) => { const tooltipId = `block-help-${block.type}`; return <button key={block.type} className="chip" disabled={busy} draggable={!busy} aria-describedby={tooltipId} onDragStart={(event) => onDrag(block.type, event)} onDragEnd={onDragEnd} onClick={() => add(block.type)}><BlockIcon {...block} /><span className="chip-copy"><span className="chip-label">{block.label}</span><span className="chip-tooltip" id={tooltipId} role="tooltip">{block.description}</span></span><span className="add-sign" aria-hidden="true">+</span></button>; })}</div>
    <p className="palette-hint">Arrastra un bloque a la cadena o haz clic para agregarlo al final.</p>
    <p className="palette-hint">Cada bloque es un paso. Conéctalos en orden para dar forma a tu agente.</p>
  </aside>;
}
