import type { RunEvent } from "../../core/domain/models.ts";
import type { RunEventSink } from "../../core/ports/contracts.ts";

/** Receptor efímero de eventos para la respuesta HTTP de comprobación. */
export class CollectingRunEvents implements RunEventSink {
  readonly events: RunEvent[] = [];
  emit(event: RunEvent): void { this.events.push(structuredClone(event)); }
}
