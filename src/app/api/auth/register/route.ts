import { NextResponse } from "next/server";
import { SupabaseAccountRegistration } from "../../../../adapters/persistence/supabase-account.ts";

type RegisterBody = { email?: unknown; password?: unknown; name?: unknown };

function validRegistration(body: RegisterBody): body is { email: string; password: string; name: string } {
  return typeof body.email === "string" && body.email.trim().includes("@") && typeof body.password === "string" && body.password.length > 0 && (body.name === undefined || typeof body.name === "string");
}

/** Crea una cuenta confirmada sin usar los enlaces de correo de Supabase Auth. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as RegisterBody | null;
  if (!body || !validRegistration(body)) return NextResponse.json({ error: "Completa un correo y una contraseña válidos." }, { status: 400 });

  try {
    const user = await new SupabaseAccountRegistration().createUser({ email: body.email.trim(), password: body.password, name: body.name?.trim() ?? "" });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No pudimos crear tu cuenta." }, { status: 400 });
  }
}
