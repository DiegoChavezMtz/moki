import type { Metadata } from "next";
import "@fontsource-variable/montserrat";
import "./globals.css";

export const metadata: Metadata = {
  title: "Moki · Crea agentes paso a paso",
  description: "Tu primera herramienta para crear agentes de IA, paso a paso y en español.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
