import assert from "node:assert/strict";
import test from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { escribir } from "../../src/adapters/blocks/escribir.ts";
import type { Agent } from "../../src/core/domain/models.ts";
import { RunAgent } from "../../src/core/use-cases/run-agent.ts";
import { FakeLLM, MemoryEvents } from "../core/doubles.ts";

const enabled = process.env.RUN_SUPABASE_INTEGRATION === "1";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type Actor = { id: string; client: SupabaseClient };

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Falta ${name} para la prueba de integración.`);
  return value;
}

async function createActor(label: string, admin: SupabaseClient): Promise<Actor> {
  const email = `moki-integration-${label}-${crypto.randomUUID()}@example.test`;
  const password = `Moki-${crypto.randomUUID()}-9a`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (createError || !created.user) throw new Error(`No pudimos crear una cuenta efímera de integración: ${createError?.code ?? "sin código"} ${createError?.message ?? "sin detalle"}`);
  const client = createClient(required(url, "NEXT_PUBLIC_SUPABASE_URL"), required(publishableKey, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"));
  const { data: session, error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError || !session.user) throw new Error("No pudimos iniciar sesión con una cuenta efímera.");
  return { id: session.user.id, client };
}

function realRepository(client: SupabaseClient) {
  return {
    async get(id: string): Promise<Agent | null> {
      const { data, error } = await client.from("agents").select("id,owner_id,title,description,forked_from,steps(id,block_type,instruction,position)").eq("id", id).maybeSingle();
      if (error || !data) return null;
      const row = data as { id: string; owner_id: string; title: string; description: string; forked_from: string | null; steps: { id: string; block_type: string; instruction: string; position: number }[] | null };
      return { id: row.id, ownerId: row.owner_id, title: row.title, description: row.description, forkedFrom: row.forked_from ?? undefined, steps: (row.steps ?? []).sort((a, b) => a.position - b.position).map((step) => ({ id: step.id, blockType: step.block_type, instruction: step.instruction })) };
    },
    async save(): Promise<void> { throw new Error("La prueba usa la RPC real para guardar."); },
    async listAll(): Promise<Agent[]> { return []; },
    async listByOwner(): Promise<Agent[]> { return []; },
    async delete(): Promise<void> { throw new Error("La prueba no elimina mediante este repositorio."); },
  };
}

test("Supabase real: crear, editar, ejecutar y respetar permisos entre dos cuentas", { skip: !enabled }, async () => {
  const admin = createClient(required(url, "NEXT_PUBLIC_SUPABASE_URL"), required(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY"), { auth: { autoRefreshToken: false, persistSession: false } });
  let owner: Actor | undefined;
  let visitor: Actor | undefined;
  const agentId = crypto.randomUUID();
  const stepId = crypto.randomUUID();

  try {
    owner = await createActor("owner", admin);
    visitor = await createActor("visitor", admin);
    const save = (client: SupabaseClient, title: string, description: string, instruction: string) => client.rpc("moki_save_agent", { p_id: agentId, p_title: title, p_description: description, p_steps: [{ id: stepId, blockType: "escribir", instruction }], p_forked_from: null });
    assert.equal((await save(owner.client, "Versión inicial", "Agente de integración.", "Responde con la versión inicial.")).error, null);
    assert.equal((await save(owner.client, "Versión editada", "Agente editado antes de ejecutar.", "Responde con la versión editada.")).error, null);

    const ownerRepo = realRepository(owner.client);
    const visitorRepo = realRepository(visitor.client);
    const visible = await visitorRepo.get(agentId);
    assert.equal(visible?.title, "Versión editada");
    assert.equal(visible?.steps[0].instruction, "Responde con la versión editada.");

    const llm = new FakeLLM([{ content: "Ejecuté la versión editada." }]);
    const events = new MemoryEvents();
    const executed = await RunAgent(agentId, visitor.id, "Caso de integración", { repo: visitorRepo, llm, events, newId: () => "run-integration", blocks: [escribir] });
    assert.equal(executed.output, "Ejecuté la versión editada.");
    assert.match(llm.requests[0].messages[0].content, /versión editada/);

    const forbiddenSave = await save(visitor.client, "Intento ajeno", "No debe guardarse.", "No debe reemplazar.");
    assert.ok(forbiddenSave.error);

    const forbiddenDelete = await visitor.client.from("agents").delete().eq("id", agentId);
    assert.equal(forbiddenDelete.error, null);
    assert.equal((await ownerRepo.get(agentId))?.title, "Versión editada");
  } finally {
    await admin.from("agents").delete().eq("id", agentId);
    await Promise.all([owner ? admin.auth.admin.deleteUser(owner.id) : undefined, visitor ? admin.auth.admin.deleteUser(visitor.id) : undefined]);
  }
});
