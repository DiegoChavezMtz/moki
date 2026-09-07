import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../adapters/persistence/server-client.ts";

function appUrl(request: Request, path: string): URL {
  const fallback = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? fallback.host;
  const protocol = request.headers.get("x-forwarded-proto") ?? fallback.protocol.replace(":", "");
  return new URL(path, `${protocol}://${host}`);
}

function loginPage(request: Request, error?: string): URL {
  const url = appUrl(request, "/login");
  if (error) url.searchParams.set("error", error);
  return url;
}

/** Respaldo del formulario de acceso cuando el navegador no hidrata React. */
export async function POST(request: Request) {
  const form = await request.formData();
  const email = form.get("email");
  const password = form.get("password");
  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
    return NextResponse.redirect(loginPage(request, "invalid"), 303);
  }

  const client = await createServerSupabaseClient();
  const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  if (error) return NextResponse.redirect(loginPage(request, "invalid"), 303);
  return NextResponse.redirect(appUrl(request, "/constructor"), 303);
}
