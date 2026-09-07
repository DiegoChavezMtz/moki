import type { BlockPlugin } from "../../core/ports/contracts.ts";

export const escribir: BlockPlugin = {
  manifest: {
    type: "escribir",
    label: "Escribir / responder",
    color: "#ff1455",
    icon: "pencil",
    placeholder: "Describe cómo quieres que se redacte la respuesta final.",
  },
};
