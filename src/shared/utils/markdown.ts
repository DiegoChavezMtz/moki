/** MiniMax a veces escapa sintaxis Markdown válida; se normaliza antes de renderizarla. */
export function normalizeMarkdown(value: string): string {
  return value.replace(/\\([\\`*{}_\[\]<>()#+\-.!|~])/g, "$1");
}
