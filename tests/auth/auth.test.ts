import { test } from "node:test";
import assert from "node:assert/strict";
import { createAuthService } from "../../src/shared/services/auth.ts";
type Gateway = Parameters<typeof createAuthService>[0];
function setup(overrides: Partial<Gateway> = {}) {
  const calls: unknown[] = [];
  const gateway = {
    signUp: async (input: unknown) => { calls.push(input); return { data: { user: { id: "user-1", email: "uno@example.test" }, session: null }, error: null }; },
    signInWithPassword: async (input: unknown) => { calls.push(input); return { data: { user: { id: "user-1", email: "uno@example.test" } }, error: null }; },
    signOut: async (input: unknown) => { calls.push(input); return { error: null }; },
    resetPasswordForEmail: async (...input: unknown[]) => { calls.push(input); return { error: null }; },
    getUser: async () => ({ data: { user: { id: "user-1", email: "uno@example.test" } }, error: null }),
    updateUser: async (input: unknown) => { calls.push(input); return { data: {}, error: null }; },
    ...overrides,
  } as unknown as Gateway;
  return { service: createAuthService(gateway), calls };
}
test("registro guarda el nombre visible como metadato y no devuelve tokens", async () => {
  const { service, calls } = setup();
  assert.deepEqual(await service.register(" Ana ", " uno@example.test ", "password", "https://moki.example/login"), { user: { id: "user-1", email: "uno@example.test" }, confirmationRequired: true });
  assert.deepEqual(calls, [{ email: "uno@example.test", password: "password", options: { data: { name: "Ana" }, emailRedirectTo: "https://moki.example/login" } }]);
});
test("login limpia el correo, conserva la contraseña y no devuelve tokens", async () => {
  const { service, calls } = setup();
  assert.deepEqual(await service.login(" uno@example.test ", " password "), { id: "user-1", email: "uno@example.test" });
  assert.deepEqual(calls, [{ email: "uno@example.test", password: " password " }]);
});
test("logout cierra la sesión del navegador mediante SDK", async () => {
  const { service, calls } = setup(); await service.logout();
  assert.deepEqual(calls, [{ scope: "local" }]);
});
test("recuperación transmite al SDK correo y destino fijo de la app", async () => {
  const { service, calls } = setup();
  await service.recoverPassword(" uno@example.test ", "https://moki.example/cambiar-contrasena");
  assert.deepEqual(calls, [["uno@example.test", { redirectTo: "https://moki.example/cambiar-contrasena" }]]);
});
test("cambio de contraseña verifica la identidad primero", async () => {
  const { service, calls } = setup(); await service.changePassword("nueva contraseña");
  assert.deepEqual(calls, [{ password: "nueva contraseña" }]);
});
test("una sesión ausente impide el cambio", async () => {
  const { service, calls } = setup({ getUser: async () => ({ data: { user: null }, error: null }) } as unknown as Partial<Gateway>);
  assert.equal(await service.currentUser(), null);
  await assert.rejects(service.changePassword("password"), /recuperación o inicia sesión/);
  assert.deepEqual(calls, []);
});
test("los errores del proveedor se traducen sin revelar detalles técnicos", async () => {
  const { service } = setup({ signInWithPassword: async () => ({ data: {}, error: { code: "invalid_credentials", message: "secret database detail" } }) } as unknown as Partial<Gateway>);
  await assert.rejects(service.login("uno@example.test", "password"), { message: "El correo o la contraseña no son correctos." });
});
test("un error desconocido no se muestra como éxito ni se expone", async () => {
  const { service } = setup({ resetPasswordForEmail: async () => ({ data: {}, error: { code: "unexpected", message: "secret" } }) } as unknown as Partial<Gateway>);
  await assert.rejects(service.recoverPassword("uno@example.test", "https://moki.example"), { message: "No pudimos completar la solicitud. Inténtalo de nuevo." });
});
