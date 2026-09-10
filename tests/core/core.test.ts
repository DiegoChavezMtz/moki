import { test } from "node:test";
import assert from "node:assert/strict";
import { ModelLimitError, ForbiddenError, NotFoundError, UnauthenticatedError, ValidationError } from "../../src/core/domain/errors.ts";
import { ValidateAgent } from "../../src/core/use-cases/validate-agent.ts";
import { DeleteAgent } from "../../src/core/use-cases/delete-agent.ts";
import { ForkAgent } from "../../src/core/use-cases/fork-agent.ts";
import { SaveAgent } from "../../src/core/use-cases/save-agent.ts";
import { RunAgent, EXECUTION_POLICY } from "../../src/core/use-cases/run-agent.ts";
import type { BlockPlugin } from "../../src/core/ports/contracts.ts";
import { agent, blocks, FakeLLM, MemoryAgentRepository, MemoryEvents } from "./doubles.ts";

async function setup() {
  const repo = new MemoryAgentRepository();
  await repo.save(agent());
  return { repo, blocks, llm: new FakeLLM([{ content: "Puntos ordenados" }, { content: "Resumen final" }]), events: new MemoryEvents(), newId: () => "run-1" };
}

test("valida una cadena sin modificarla y admite un bloque técnico", () => {
  const value = agent(); const before = structuredClone(value);
  ValidateAgent(value); assert.deepEqual(value, before);
  value.steps = value.steps.slice(0, 1); ValidateAgent(value);
});

test("informa todos los campos e instrucciones vacíos, con el bloque identificado", () => {
  const value = agent(); value.title = " "; value.description = "\n";
  value.steps[1].instruction = " \n ";
  assert.throws(() => ValidateAgent(value), (error: unknown) => {
    assert.ok(error instanceof ValidationError);
    assert.equal(error.issues.length, 3);
    assert.equal(error.issues[2].stepId, "dos");
    assert.match(error.message, /bloque 2/); return true;
  });
});

test("rechaza cadena vacía, bloques desconocidos e identificadores duplicados", () => {
  const value = agent(); value.steps = [];
  assert.throws(() => ValidateAgent(value), ValidationError);
  const unknown = agent(); unknown.steps[0].blockType = "enviar-correo";
  assert.throws(() => ValidateAgent(unknown), ValidationError);
  const duplicate = agent(); duplicate.steps[1].id = duplicate.steps[0].id;
  assert.throws(() => ValidateAgent(duplicate), ValidationError);
});

test("el repositorio en memoria ofrece CRUD, listados e independencia de referencias", async () => {
  const { repo } = await setup();
  const second = { ...agent(), id: "otro", ownerId: "bea" }; await repo.save(second);
  second.steps[0].instruction = "Mutación externa";
  const values = await repo.listAll(); assert.equal(values.length, 2);
  assert.equal((await repo.listByOwner("ana")).length, 1);
  values[0].steps[0].instruction = "No persistir";
  assert.equal((await repo.get("original"))?.steps[0].instruction, agent().steps[0].instruction);
  const update = agent(); update.title = "Actualizado"; await repo.save(update);
  assert.equal((await repo.get("original"))?.title, "Actualizado");
  await repo.delete("otro"); assert.equal(await repo.get("otro"), null);
});

test("solo el dueño puede borrar y los rechazos conservan el agente", async () => {
  const { repo } = await setup();
  await assert.rejects(DeleteAgent("original", "bea", repo), ForbiddenError);
  await assert.rejects(DeleteAgent("original", " ", repo), UnauthenticatedError);
  await assert.rejects(DeleteAgent("ausente", "ana", repo), NotFoundError);
  assert.ok(await repo.get("original"));
  await DeleteAgent("original", "ana", repo); assert.equal(await repo.get("original"), null);
});

test("guardar valida la cadena y no permite crear ni editar en nombre de otra persona", async () => {
  const { repo } = await setup();
  const created = { ...agent(), id: "nuevo", ownerId: "bea" };
  await SaveAgent(created, "bea", repo);
  assert.equal((await repo.get("nuevo"))?.ownerId, "bea");
  const impersonated = { ...agent(), id: "impostor", ownerId: "ana" };
  await assert.rejects(SaveAgent(impersonated, "bea", repo), ForbiddenError);
  const foreignEdit = { ...agent(), title: "No permitido", ownerId: "bea" };
  await assert.rejects(SaveAgent(foreignEdit, "bea", repo), ForbiddenError);
  const invalid = { ...agent(), id: "invalido", ownerId: "bea", steps: [] };
  await assert.rejects(SaveAgent(invalid, "bea", repo), ValidationError);
});

test("fork preserva el original y crea una copia editable por su nuevo dueño", async () => {
  const { repo } = await setup();
  const fork = await ForkAgent("original", "bea", repo, () => "copia");
  assert.equal(fork.id, "copia"); assert.equal(fork.ownerId, "bea"); assert.equal(fork.forkedFrom, "original");
  fork.steps[0].instruction = "Instrucción nueva"; await repo.save(fork);
  assert.deepEqual(await repo.get("original"), agent());
  await assert.rejects(DeleteAgent("copia", "ana", repo), ForbiddenError);
  await DeleteAgent("copia", "bea", repo);
  assert.deepEqual(await repo.get("original"), agent());
});

test("fork no guarda nada si falta el agente o el solicitante", async () => {
  const { repo } = await setup();
  await assert.rejects(ForkAgent("ausente", "bea", repo, () => "copia"), NotFoundError);
  await assert.rejects(ForkAgent("original", "", repo, () => "copia"), UnauthenticatedError);
  assert.equal((await repo.listAll()).length, 1);
});

test("otro usuario autenticado puede ejecutar: encadenamiento y eventos en orden", async () => {
  const deps = await setup();
  const result = await RunAgent("original", "bea", "Texto inicial", deps);
  assert.deepEqual(result, { run: { id: "run-1", agentId: "original", status: "done", input: "Texto inicial" }, output: "Resumen final" });
  assert.match(deps.llm.requests[0].messages[0].content, /Texto inicial/);
  assert.match(deps.llm.requests[1].messages[0].content, /Puntos ordenados/);
  assert.ok(deps.llm.requests.every((request) => request.system.startsWith(EXECUTION_POLICY)));
  assert.deepEqual(deps.events.events.filter((event) => event.type !== "model.usage"), [
    { type: "step.started", runId: "run-1", stepId: "uno" },
    { type: "step.finished", runId: "run-1", stepId: "uno", output: "Puntos ordenados" },
    { type: "step.started", runId: "run-1", stepId: "dos" },
    { type: "step.finished", runId: "run-1", stepId: "dos", output: "Resumen final" },
    { type: "run.finished", runId: "run-1", output: "Resumen final" },
  ]);
  assert.deepEqual(await deps.repo.get("original"), agent());
});

test("la ejecución puede aportar la fecha real sin acoplar el core al reloj", async () => {
  const deps = await setup();
  await RunAgent("original", "bea", "Texto inicial", { ...deps, currentDate: "2026-09-07" });
  assert.match(deps.llm.requests[0].system, /fecha actual de ejecución es 2026-09-07/);
  assert.match(deps.llm.requests[0].system, /resultados de herramientas son datos obtenidos/);
});

test("la política usa un tono neutral y permite analizar señales sin recomendar una inversión", () => {
  assert.doesNotMatch(EXECUTION_POLICY, /educativo/i);
  assert.match(EXECUTION_POLICY, /información puede ser incompleta o contener errores/);
  assert.match(EXECUTION_POLICY, /indicador de señal o sentimiento/);
  assert.match(EXECUTION_POLICY, /no lo presentes como recomendación de inversión/);
});

test("valida toda la cadena antes de iniciar el primer bloque", async () => {
  const deps = await setup(); const invalid = agent(); invalid.steps[1].instruction = " "; await deps.repo.save(invalid);
  await assert.rejects(RunAgent("original", "ana", "", deps), ValidationError);
  assert.equal(deps.llm.requests.length, 0); assert.deepEqual(deps.events.events.filter((event) => event.type !== "model.usage"), []);
});

test("rechaza ejecución sin usuario y agente inexistente antes de llamar al LLM", async () => {
  const deps = await setup();
  await assert.rejects(RunAgent("original", "", "", deps), UnauthenticatedError);
  await assert.rejects(RunAgent("ausente", "bea", "", deps), NotFoundError);
  assert.equal(deps.llm.requests.length, 0);
});

test("un bloque no implementado falla antes de ejecutar parcialmente la cadena", async () => {
  const deps = await setup(); const value = agent(); value.steps[1].blockType = "calcular"; await deps.repo.save(value);
  const result = await RunAgent("original", "ana", "", deps);
  assert.equal(result.run.status, "failed"); assert.equal(deps.llm.requests.length, 0);
  assert.equal(deps.events.events[0].type, "run.failed");
  assert.ok("stepId" in deps.events.events[0]); assert.equal(deps.events.events[0].stepId, "dos");
});

test("ejecuta una sola herramienta del bloque, encadena su resultado y emite eventos verificables", async () => {
  const deps = await setup();
  const value = agent(); value.steps = [{ id: "calculo", blockType: "calcular", instruction: "Calcula el total." }]; await deps.repo.save(value);
  const inputs: unknown[] = [];
  const calcular: BlockPlugin = {
    manifest: { type: "calcular", label: "Hacer un cálculo", color: "", icon: "", placeholder: "" },
    tool: { schema: { name: "hacer_un_calculo", description: "Calcula", inputSchema: {} }, async execute(input) { inputs.push(input); return { result: "0.3" }; } },
  };
  deps.blocks = [calcular];
  deps.llm = new FakeLLM([
    { content: "", toolCalls: [{ id: "tool-1", name: "hacer_un_calculo", input: { expression: "0.1 + 0.2" } }] },
    { content: "El total es 0.3." },
  ]);

  const result = await RunAgent("original", "ana", "Monto inicial", deps);
  assert.equal(result.output, "El total es 0.3.");
  assert.deepEqual(inputs, [{ expression: "0.1 + 0.2" }]);
  assert.deepEqual(deps.llm.requests[1].messages.slice(1), [
    { role: "assistant", content: "", toolCalls: [{ id: "tool-1", name: "hacer_un_calculo", input: { expression: "0.1 + 0.2" } }] },
    { role: "tool", content: '{"result":"0.3"}', toolCallId: "tool-1" },
  ]);
  assert.deepEqual(deps.events.events.filter((event) => event.type !== "model.usage").map((event) => event.type), ["step.started", "tool.called", "tool.result", "step.finished", "run.finished"]);
});

test("conserva la evidencia de cada herramienta para la respuesta final de una cadena", async () => {
  const deps = await setup();
  const value = agent();
  value.steps = [
    { id: "busqueda-uno", blockType: "buscar-web", instruction: "Busca rentabilidad." },
    { id: "busqueda-dos", blockType: "buscar-web", instruction: "Busca cotización." },
    { id: "respuesta", blockType: "escribir", instruction: "Relaciona los datos encontrados." },
  ];
  await deps.repo.save(value);
  const buscar: BlockPlugin = {
    manifest: { type: "buscar-web", label: "Buscar en internet", color: "", icon: "", placeholder: "" },
    tool: { schema: { name: "buscar_en_internet", description: "Busca", inputSchema: {} }, async execute(input) { return input; } },
  };
  deps.blocks = [buscar, { manifest: { type: "escribir", label: "Escribir / responder", color: "", icon: "", placeholder: "" } }];
  deps.llm = new FakeLLM([
    { content: "", toolCalls: [{ id: "tool-1", name: "buscar_en_internet", input: { sources: ["Rentabilidad BIMBOA: 12%"] } }] },
    { content: "La rentabilidad mejoró." },
    { content: "", toolCalls: [{ id: "tool-2", name: "buscar_en_internet", input: { sources: ["Cotización BIMBOA: $52"] } }] },
    { content: "La cotización reciente es $52." },
    { content: "La rentabilidad y la cotización muestran una relación analizada." },
  ]);

  const result = await RunAgent("original", "ana", "Analiza BIMBOA", deps);

  assert.equal(result.output, "La rentabilidad y la cotización muestran una relación analizada.");
  const finalPrompt = deps.llm.requests[4].messages[0];
  assert.equal(finalPrompt.role, "user");
  assert.match(finalPrompt.content, /Rentabilidad BIMBOA: 12%/);
  assert.match(finalPrompt.content, /Cotización BIMBOA: \$52/);
});

test("detiene un bloque con herramienta inválida o fallida e identifica el bloque sin exponer detalles", async () => {
  const deps = await setup();
  const value = agent(); value.steps = [{ id: "busqueda", blockType: "buscar-web", instruction: "Busca una fuente." }]; await deps.repo.save(value);
  const buscar: BlockPlugin = {
    manifest: { type: "buscar-web", label: "Buscar en internet", color: "", icon: "", placeholder: "" },
    tool: { schema: { name: "buscar_en_internet", description: "Busca", inputSchema: {} }, async execute() { throw new Error("provider-secret"); } },
  };
  deps.blocks = [buscar];
  deps.llm = new FakeLLM([{ content: "", toolCalls: [{ id: "tool-1", name: "buscar_en_internet", input: {} }] }]);
  const result = await RunAgent("original", "ana", "", deps);
  assert.equal(result.run.status, "failed");
  assert.deepEqual(deps.events.events.filter((event) => event.type !== "model.usage").map((event) => event.type), ["step.started", "tool.called", "run.failed"]);
  assert.match((deps.events.events.at(-1) as { reason: string }).reason, /bloque 1/);
  assert.doesNotMatch(JSON.stringify(deps.events.events), /provider-secret/);

  const invalid = await setup(); invalid.blocks = [buscar]; invalid.llm = new FakeLLM([{ content: "", toolCalls: [{ id: "tool-1", name: "otra_herramienta", input: {} }] }]);
  const invalidAgent = agent(); invalidAgent.steps = [{ id: "busqueda", blockType: "buscar-web", instruction: "Busca una fuente." }]; await invalid.repo.save(invalidAgent);
  const invalidResult = await RunAgent("original", "ana", "", invalid);
  assert.equal(invalidResult.run.status, "failed");
  assert.deepEqual(invalid.events.events.filter((event) => event.type !== "model.usage").map((event) => event.type), ["step.started", "run.failed"]);
});

for (const response of [new Error("secret-provider-detail"), { content: " " }, { content: "", toolCalls: [{ id: "x", name: "unknown", input: {} }] }]) {
  test(`detiene la cadena sin filtrar errores técnicos: ${response instanceof Error ? "error" : JSON.stringify(response)}`, async () => {
    const deps = await setup(); deps.llm = new FakeLLM([response, { content: "No debe ejecutarse" }]);
    const result = await RunAgent("original", "ana", "", deps);
    assert.equal(result.run.status, "failed"); assert.equal(result.output, undefined);
    assert.equal(deps.llm.requests.length, 1);
    assert.deepEqual(deps.events.events.filter((event) => event.type !== "model.usage").map((event) => event.type), ["step.started", "run.failed"]);
    assert.doesNotMatch(JSON.stringify(deps.events.events), /secret-provider-detail/);
  });
}

test("un fallo en el segundo bloque conserva solo los eventos del primero y señala el segundo", async () => {
  const deps = await setup(); deps.llm = new FakeLLM([{ content: "Primero listo" }, new Error("fallo")]);
  await RunAgent("original", "ana", "", deps);
  assert.deepEqual(deps.events.events.filter((event) => event.type !== "model.usage").map((event) => event.type), ["step.started", "step.finished", "step.started", "run.failed"]);
  assert.deepEqual(deps.events.events.at(-1), { type: "run.failed", runId: "run-1", stepId: "dos", reason: "No pudimos completar el bloque 2. Intenta probarlo de nuevo." });
});


for (const code of ["tokens", "timeout"] as const) {
  test(`expone el límite del modelo y detiene la cadena: ${code}`, async () => {
    const deps = await setup();
    const error = new ModelLimitError(code);
    deps.llm = new FakeLLM([error]);
    const result = await RunAgent("original", "ana", "prueba", deps);
    assert.equal(result.run.status, "failed");
    assert.equal(deps.llm.requests.length, 1);
    assert.equal((deps.events.events.at(-1) as { reason: string }).reason, `Bloque 1: ${error.message}`);
  });
}

test("todos los bloques conservan solicitud original y hallazgos de pasos no adyacentes", async () => {
  const deps = await setup();
  const value = agent();
  value.steps.push({ id: "tres", blockType: "escribir", instruction: "Concluye" });
  await deps.repo.save(value);
  deps.llm = new FakeLLM([{ content: "Hallazgo inicial: deuda pendiente de verificar." }, { content: "Revisar noticias." }, { content: "Conclusión" }]);
  await RunAgent("original", "ana", "Analiza Bimbo sin recomendar compras", deps);
  for (const request of deps.llm.requests) assert.match(request.messages[0].content, /Solicitud original.*\nAnaliza Bimbo sin recomendar compras/);
  assert.match(deps.llm.requests[2].messages[0].content, /deuda pendiente de verificar/);
  assert.match(deps.llm.requests[2].messages[0].content, /interpretación, no hecho verificado/);
  deps.llm = new FakeLLM([{ content: "Nueva" }, { content: "Nueva" }, { content: "Nueva" }]);
  await RunAgent("original", "ana", "Analiza otra empresa", deps);
  assert.doesNotMatch(deps.llm.requests[0].messages[0].content, /Bimbo|deuda pendiente/);
});

test("contabiliza llamadas de resumen y conserva solicitud tras compactar", async () => {
  const deps = await setup();
  const requests: import("../../src/core/ports/contracts.ts").LLMRequest[] = [];
  const responses = ["Hallazgo " + "x".repeat(13000), "Hallazgos: dato pendiente. Fuente: https://ejemplo.mx. Interpretaciones: inciertas. Pendientes: verificar.", "Final"];
  const llm = { async complete(request: import("../../src/core/ports/contracts.ts").LLMRequest) {
    requests.push(request); request.onUsage?.({ inputTokens: 100, outputTokens: 20 });
    return { content: responses.shift()! };
  } };
  await RunAgent("original", "ana", "Bimbo: conservar restricciones", { ...deps, llm });
  assert.equal(requests.length, 3);
  assert.match(requests[2].messages[0].content, /Bimbo: conservar restricciones/);
  assert.match(requests[2].messages[0].content, /Resumen de pasos anteriores/);
  const usage = deps.events.events.filter((event) => event.type === "model.usage");
  assert.deepEqual(usage.map((event) => event.purpose), ["block", "memory", "block"]);
  assert.deepEqual(usage.map((event) => event.stepNumber), [1, 2, 2]);
  assert.equal(usage.reduce((total, event) => total + (event.usage?.inputTokens ?? 0), 0), 300);
});

test("un error de proveedor conserva consumo desconocido, no cero", async () => {
  const deps = await setup(); deps.llm = new FakeLLM([new Error("secret")]);
  await RunAgent("original", "ana", "Caso", deps);
  const usage = deps.events.events.filter((event) => event.type === "model.usage");
  assert.equal(usage.length, 1); assert.equal(usage[0].usage, null);
});

test("la búsqueda exige herramienta aunque el bloque anterior niegue acceso", async () => {
  const deps = await setup(); const value = agent();
  value.steps[1] = { id: "busqueda", blockType: "buscar-web", instruction: "Busca tendencias de la acción" };
  await deps.repo.save(value);
  let executed = 0;
  deps.blocks = [...blocks, { manifest: { type: "buscar-web", label: "Buscar", color: "", icon: "", placeholder: "" }, tool: {
    schema: { name: "buscar", description: "Busca", inputSchema: {} },
    async execute() { executed++; return { sources: [{ url: "https://ejemplo.mx" }] }; },
  } }];
  deps.llm = new FakeLLM([{ content: "No tengo acceso a internet" }, { content: "", toolCalls: [{ id: "t", name: "buscar", input: {} }] }, { content: "Datos recuperados" }]);
  const result = await RunAgent("original", "ana", "como anda bimbo para ir largo?", deps);
  assert.equal(result.run.status, "done"); assert.equal(executed, 1);
  assert.equal(deps.llm.requests[0].requiredTool, undefined);
  assert.match(deps.llm.requests[0].system, /No prometas búsquedas/);
  assert.equal(deps.llm.requests[1].requiredTool, "buscar");
  assert.match(deps.llm.requests[1].system, /afirmaciones anteriores sobre falta de acceso/);
  assert.match(deps.llm.requests[1].messages[0].content, /como anda bimbo/);
  assert.equal(deps.llm.requests[2].requiredTool, undefined);
  assert.match(deps.llm.requests[2].system, /ya se ejecutó/);
});

for (const [toolCalls, expected] of [
  [undefined, /sin solicitar la herramienta/],
  [[{ id: "t", name: "buscar", input: {} }, { id: "u", name: "buscar", input: {} }], /varias herramientas/],
  [[{ id: "t", name: "otra", input: {} }], /no corresponde/],
] as const) {
  test(`identifica llamada de herramienta inválida: ${expected}`, async () => {
    const deps = await setup(); const value = agent();
    value.steps = [{ id: "buscar", blockType: "buscar-web", instruction: "Busca" }]; await deps.repo.save(value);
    deps.blocks = [{ manifest: { type: "buscar-web", label: "Buscar", color: "", icon: "", placeholder: "" }, tool: {
      schema: { name: "buscar", description: "Busca", inputSchema: {} }, async execute() { assert.fail("No ejecutar herramientas inválidas"); },
    } }];
    deps.llm = new FakeLLM([{ content: "Respuesta sin ejecutar", ...(toolCalls ? { toolCalls: [...toolCalls] } : {}) }]);
    await RunAgent("original", "ana", "Caso", deps);
    const failed = deps.events.events.at(-1);
    assert.equal(failed?.type, "run.failed");
    if (failed?.type === "run.failed") assert.match(failed.reason, expected);
  });
}
