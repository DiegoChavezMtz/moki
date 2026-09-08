import { test } from "node:test";
import assert from "node:assert/strict";
import { createAuthService } from "../../src/shared/services/auth.ts";
type Gateway = Parameters<typeof createAuthService>[0];
function setup(overrides: Partial<Gateway> = {}) {
  const calls: unknown[] = [];
  const gateway = {
    signInWithPassword: async (input: unknown) => { calls.push(input); return { data: { user: { id: "user-1", email: "uno@example.test" } }, error: null }; },
    signOut: async (input: unknown) => { calls.push(input); return { error: null }; },
    getUser: async () => ({ data: { user: { id: "user-1", email: "uno@example.test" } }, error: null }),
    ...overrides,
  } as unknown as Gateway;
  return { service: createAuthService(gateway), calls };
}
test("login limpia el correo, conserva la contraseña y no devuelve tokens", async () => {
  const { service, calls } = setup();
  assert.deepEqual(await service.login(" uno@example.test ", " password "), { id: "user-1", email: "uno@example.test" });
  assert.deepEqual(calls, [{ email: "uno@example.test", password: " password " }]);
});
test("logout cierra la sesión del navegador mediante SDK", async () => {
  const { service, calls } = setup(); await service.logout();
  assert.deepEqual(calls, [{ scope: "local" }]);
});
test("los errores del proveedor se traducen sin revelar detalles técnicos", async () => {
  const { service } = setup({ signInWithPassword: async () => ({ data: {}, error: { code: "invalid_credentials", message: "secret database detail" } }) } as unknown as Partial<Gateway>);
  await assert.rejects(service.login("uno@example.test", "password"), { message: "El correo o la contraseña no son correctos." });
});
