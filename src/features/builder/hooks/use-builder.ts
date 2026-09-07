"use client";
import { useEffect, useRef, useState } from "react";
import { deleteAgent, listAgents, saveAgent } from "../services/agents.ts";
import { currentUser } from "../../../shared/services/auth";
import { runSavedAgent, type SearchSource } from "../../../shared/services/agent-run.ts";
import { logout } from "../../../shared/services/auth";
import { useRouter } from "next/navigation";
import type { Agent } from "../../../core/domain/models.ts";
import { hasErrors, moveStep, validateDraft, type BlockType, type Draft, type DraftErrors } from "../utils/chain.ts";
export type ChatMessage = { role: "user" | "assistant"; text: string; sources?: SearchSource[] };
const initialMessage: ChatMessage = { role: "assistant", text: "Arma tu cadena y pruébala con un caso real. La respuesta se genera al ejecutar el agente." };

export function useBuilder() {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>({ title: "", description: "", steps: [] });
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savedOwnerId, setSavedOwnerId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Map<string, File>>(new Map());
  const [agents, setAgents] = useState<Agent[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [showAgents, setShowAgents] = useState(false);
  const [errors, setErrors] = useState<DraftErrors>({ steps: {} });
  const [notice, setNotice] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);
  const [busy, setBusy] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const run = useRef<AbortController | null>(null);
  useEffect(() => () => run.current?.abort(), []);
  async function refreshAgents() {
    setBusy(true); setNotice("");
    try { const [saved, user] = await Promise.all([listAgents(), currentUser()]); setAgents(saved); setOwnerId(user?.id ?? null); setShowAgents(true); }
    catch (error) { setNotice(error instanceof Error ? error.message : "No pudimos cargar los agentes."); }
    finally { setBusy(false); }
  }
  function openAgent(agent: Agent) {
    setDraft({ title: agent.title, description: agent.description, steps: agent.steps.map((step) => ({ ...step })) });
    setDocuments(new Map());
    setSavedId(agent.id); setSavedOwnerId(agent.ownerId); setShowAgents(false); setNotice(agent.ownerId === ownerId ? "Editando tu agente guardado." : "Este agente pertenece a otra persona: puedes consultarlo, pero no modificarlo.");
  }
  async function removeAgent(agent: Agent) {
    if (agent.ownerId !== ownerId) return;
    setBusy(true); setNotice("");
    try { await deleteAgent(agent.id); setAgents((items) => items.filter((item) => item.id !== agent.id)); if (savedId === agent.id) { setSavedId(null); setSavedOwnerId(null); setDraft({ title: "", description: "", steps: [] }); setDocuments(new Map()); } setNotice("Agente eliminado."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "No pudimos eliminar el agente."); }
    finally { setBusy(false); }
  }
  async function signOut() {
    setBusy(true); setNotice("");
    try { await logout(); router.replace("/login"); }
    catch { setNotice("No pudimos cerrar la sesión. Inténtalo de nuevo."); }
    finally { setBusy(false); }
  }
  function edit(change: (value: Draft) => Draft) {
    if (run.current) return;
    setDraft(change); setErrors({ steps: {} }); setNotice("");
  }
  function add(type: BlockType, at = draft.steps.length) {
    const id = crypto.randomUUID();
    edit((value) => ({ ...value, steps: [...value.steps.slice(0, at), { id, blockType: type, instruction: "" }, ...value.steps.slice(at)] }));
  }
  function move(id: string, at: number) { edit((value) => ({ ...value, steps: moveStep(value.steps, id, at) })); }
  function remove(id: string) { edit((value) => ({ ...value, steps: value.steps.filter((step) => step.id !== id) })); }
  function instruction(id: string, text: string) { edit((value) => ({ ...value, steps: value.steps.map((step) => step.id === id ? { ...step, instruction: text } : step) })); }
  function document(stepId: string, file: File | null) { setDocuments((current) => { const next = new Map(current); if (file) next.set(stepId, file); else next.delete(stepId); return next; }); }
  function metadata(field: "title" | "description", value: string) { edit((draft) => ({ ...draft, [field]: value })); }
  function newAgent() {
    if (run.current) return;
    setDraft({ title: "", description: "", steps: [] }); setSavedId(null); setSavedOwnerId(null); setDocuments(new Map());
    setErrors({ steps: {} }); setInput(""); setMessages([initialMessage]); setShowAgents(false); setNotice("Nuevo borrador listo para crear un agente.");
  }
  async function save() {
    const next = validateDraft(draft, "save"); setErrors(next);
    if (hasErrors(next)) { setNotice("Completa los campos señalados. Tu agente no se ha guardado."); return; }
    setBusy(true); setNotice("");
    try {
      const id = savedId ?? crypto.randomUUID();
      await saveAgent({ id, ...draft }, !!savedId);
      setSavedId(id); setSavedOwnerId(ownerId); setNotice("Agente guardado en Mis agentes.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No pudimos guardar el agente. Inténtalo de nuevo.");
    } finally { setBusy(false); }
  }
  async function test() {
    if (run.current) return;
    const next = validateDraft(draft, "test"); setErrors(next);
    if (hasErrors(next)) { setNotice(next.chain || "Completa las instrucciones de los bloques señalados antes de probar."); return; }
    const missingDocument = draft.steps.find((step) => step.blockType === "leer-documento" && !documents.has(step.id));
    if (missingDocument) { setNotice(`Carga un documento para el bloque ${draft.steps.indexOf(missingDocument) + 1}.`); return; }
    setNotice(""); const controller = new AbortController(); run.current = controller; setBusy(true);
    setMessages((values) => [...values, { role: "user", text: input.trim() || "Caso de prueba de ejemplo" }]); setInput("");
    try {
      let executionId = savedId;
      if (!executionId) {
        const saveErrors = validateDraft(draft, "save"); setErrors(saveErrors);
        if (hasErrors(saveErrors)) { setNotice("Agrega título y descripción antes de ejecutar el agente."); return; }
        executionId = crypto.randomUUID();
        await saveAgent({ id: executionId, ...draft }, false);
        setSavedId(executionId); setSavedOwnerId(ownerId);
      }
      const result = await runSavedAgent(executionId, input.trim() || "Caso de prueba de ejemplo", documents);
      setMessages((values) => [...values, { role: "assistant", text: result.output ?? "La ejecución no produjo una respuesta.", ...(result.sources.length ? { sources: result.sources } : {}) }]);
    } catch (error) {
      if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : "No pudimos ejecutar el agente. Inténtalo de nuevo.");
    } finally {
      if (!controller.signal.aborted) { setBusy(false); setActiveId(null); }
      run.current = null;
    }
  }
  const editable = !savedId || savedOwnerId === ownerId;
  return { draft, savedId, agents, ownerId, showAgents, editable, errors, notice, input, setInput, messages, busy, activeId, add, move, remove, instruction, document, metadata, newAgent, save, test, refreshAgents, openAgent, removeAgent, signOut, documents, closeAgents: () => setShowAgents(false) };
}
