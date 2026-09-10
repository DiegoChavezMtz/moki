import type { UsageCall } from "../services/agent-run";

export function TokenUsageDetails({ calls }: { calls: UsageCall[] }) {
  const rows = new Map<string, { number: number; input: number; output: number; known: number; missing: number; summaries: number }>();
  for (const call of calls) {
    const row = rows.get(call.stepId) ?? { number: call.stepNumber, input: 0, output: 0, known: 0, missing: 0, summaries: 0 };
    if (call.usage) { row.input += call.usage.inputTokens; row.output += call.usage.outputTokens; row.known++; }
    else row.missing++;
    if (call.purpose === "memory") row.summaries++;
    rows.set(call.stepId, row);
  }
  const entries = [...rows.values()];
  const input = entries.reduce((sum, row) => sum + row.input, 0);
  const output = entries.reduce((sum, row) => sum + row.output, 0);
  const known = entries.some((row) => row.known);
  const partial = entries.some((row) => row.missing);
  const format = (value: number) => value.toLocaleString("es-MX");
  return <details className="token-usage-details">
    <summary>Consumo de tokens · {known ? `${format(input + output)}${partial ? " reportados (parcial)" : " en total"}` : "No disponible"}</summary>
    <p>Consumo reportado por el proveedor. Incluye las llamadas para resumir memoria; no indica contexto restante.</p>
    {entries.length ? <table><caption>Consumo por bloque</caption><thead><tr><th scope="col">Bloque</th><th scope="col">Entrada</th><th scope="col">Salida</th><th scope="col">Total</th></tr></thead><tbody>
      {entries.map((row) => <tr key={row.number}><th scope="row">{row.number}{row.summaries ? " (incluye memoria)" : ""}{row.missing ? " · parcial" : ""}</th><td>{row.known ? format(row.input) : "No disponible"}</td><td>{row.known ? format(row.output) : "No disponible"}</td><td>{row.known ? format(row.input + row.output) : "No disponible"}</td></tr>)}
    </tbody><tfoot><tr><th scope="row">{partial ? "Total reportado (parcial)" : "Total"}</th><td>{known ? format(input) : "No disponible"}</td><td>{known ? format(output) : "No disponible"}</td><td>{known ? format(input + output) : "No disponible"}</td></tr></tfoot></table> : <p>El proveedor no reportó el consumo de esta ejecución.</p>}
  </details>;
}
