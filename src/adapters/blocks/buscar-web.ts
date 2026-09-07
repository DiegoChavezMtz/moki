import "server-only";
import type { BlockPlugin } from "../../core/ports/contracts.ts";

const BRAVE_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search";
const DATE_RANGE = /^\d{4}-\d{2}-\d{2}$/;

export type BraveSearchConfig = { apiKey: string; fetch?: typeof fetch; now?: () => Date };
type RelativeDate = "day" | "week" | "month" | "year";
type SearchInput = { query: string; period?: RelativeDate; from?: string; to?: string };
export type SearchSource = { title: string; url: string; excerpt: string; age?: string; pageAge?: string };

export function readBraveSearchConfig(): BraveSearchConfig {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY?.trim();
  if (!apiKey) throw new Error("Falta configurar Brave Search en el servidor.");
  return { apiKey };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDate(value: string): boolean {
  if (!DATE_RANGE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function inputError(): never {
  throw new Error("La búsqueda necesita una consulta y un filtro de fecha válido, si se indica.");
}

function parseInput(value: unknown): SearchInput {
  if (!isRecord(value) || typeof value.query !== "string") inputError();
  const query = value.query.trim();
  if (!query || query.length > 400) inputError();
  const period = value.period;
  const from = value.from;
  const to = value.to;
  if (period !== undefined && period !== "day" && period !== "week" && period !== "month" && period !== "year") inputError();
  if (from !== undefined && (typeof from !== "string" || !isDate(from))) inputError();
  if (to !== undefined && (typeof to !== "string" || !isDate(to))) inputError();
  if ((from === undefined) !== (to === undefined) || (period !== undefined && from !== undefined)) inputError();
  if (from !== undefined && to !== undefined && from > to) inputError();
  return { query, ...(period ? { period } : {}), ...(from && to ? { from, to } : {}) };
}

function parseSources(payload: unknown): SearchSource[] {
  if (!isRecord(payload) || !isRecord(payload.web) || !Array.isArray(payload.web.results)) {
    throw new Error("La búsqueda web no devolvió resultados utilizables.");
  }
  return payload.web.results.flatMap((value): SearchSource[] => {
    if (!isRecord(value) || typeof value.title !== "string" || typeof value.url !== "string") return [];
    try {
      const url = new URL(value.url);
      if (url.protocol !== "https:" && url.protocol !== "http:") return [];
      const age = typeof value.age === "string" && value.age.trim() ? value.age : undefined;
      const pageAge = typeof value.page_age === "string" && value.page_age.trim() ? value.page_age : undefined;
      return [{ title: value.title, url: url.toString(), excerpt: typeof value.description === "string" ? value.description : "", ...(age ? { age } : {}), ...(pageAge ? { pageAge } : {}) }];
    } catch {
      return [];
    }
  });
}

function dateFromSource(source: SearchSource): Date | null {
  if (!source.pageAge) return null;
  const date = new Date(source.pageAge);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sourcesWithinRequestedPeriod(sources: SearchSource[], input: SearchInput, now: Date): SearchSource[] {
  if (!input.period && !input.from) return sources;
  const end = input.to ? new Date(`${input.to}T23:59:59.999Z`) : now;
  const start = input.from ? new Date(`${input.from}T00:00:00.000Z`) : new Date(end);
  if (input.period) start.setUTCDate(start.getUTCDate() - ({ day: 1, week: 7, month: 31, year: 365 } as const)[input.period]);
  return sources.filter((source) => {
    const date = dateFromSource(source);
    return date !== null && date >= start && date <= end;
  });
}

/** Adaptador de Brave. No vive en el core y puede sustituirse por otro proveedor de búsqueda. */
export function createBuscarWeb(config: BraveSearchConfig): BlockPlugin {
  const apiKey = config.apiKey.trim();
  const request = config.fetch ?? fetch;
  const now = config.now ?? (() => new Date());
  if (!apiKey) throw new Error("Configuración de Brave Search incompleta.");

  return {
    manifest: {
      type: "buscar-web",
      label: "Buscar en internet",
      color: "#1F9E89",
      icon: "search",
      placeholder: "Describe qué información quieres encontrar y, si aplica, el periodo a consultar.",
    },
    tool: {
      schema: {
        name: "buscar_en_internet",
        description: "Busca fuentes web verificables para responder el bloque. Puede limitar los resultados por un periodo relativo o por un rango de fechas.",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          required: ["query"],
          properties: {
            query: { type: "string", description: "Consulta de hasta 400 caracteres." },
            period: { type: "string", enum: ["day", "week", "month", "year"], description: "Periodo relativo opcional." },
            from: { type: "string", description: "Inicio opcional del rango, YYYY-MM-DD; requiere to." },
            to: { type: "string", description: "Fin opcional del rango, YYYY-MM-DD; requiere from." },
          },
        },
      },
      async execute(input) {
        const parsed = parseInput(input);
        const url = new URL(BRAVE_SEARCH_URL);
        url.searchParams.set("q", parsed.query);
        url.searchParams.set("count", "5");
        if (parsed.period) url.searchParams.set("freshness", ({ day: "pd", week: "pw", month: "pm", year: "py" } as const)[parsed.period]);
        if (parsed.from && parsed.to) url.searchParams.set("freshness", `${parsed.from}to${parsed.to}`);

        let response: Response;
        try {
          response = await request(url, {
            headers: { Accept: "application/json", "X-Subscription-Token": apiKey },
            signal: AbortSignal.timeout(15_000),
          });
        } catch {
          throw new Error("No pudimos consultar las fuentes web. Intenta de nuevo.");
        }
        if (!response.ok) throw new Error("No pudimos consultar las fuentes web. Intenta de nuevo.");
        try {
          const sources = sourcesWithinRequestedPeriod(parseSources(await response.json()), parsed, now());
          return { query: parsed.query, sources, ...(parsed.period || parsed.from ? (sources.length ? {} : { note: "No encontramos fuentes con fecha verificable dentro del periodo solicitado." }) : {}) };
        } catch (error) {
          if (error instanceof Error && error.message.includes("resultados utilizables")) throw error;
          throw new Error("No pudimos leer los resultados de la búsqueda web.");
        }
      },
    },
  };
}
