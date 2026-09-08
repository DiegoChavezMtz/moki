import type { BlockPlugin } from "../../core/ports/contracts.ts";

/** Bloque de razonamiento puro: el modelo devuelve texto que alimenta el siguiente paso. */
export const pensar: BlockPlugin = {
  manifest: {
    type: "pensar",
    label: "Pensar / decidir",
    color: "#6C63FF",
    icon: "brain",
    placeholder: "Explica qué debe analizar o decidir este paso.",
  },
};
