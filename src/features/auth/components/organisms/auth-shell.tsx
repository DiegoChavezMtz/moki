import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import logo from "../../../../../marca/MokiLogo2.png";
import "../../auth.css";
export function AuthShell({ children }: { children: ReactNode }) {
  return <main className="auth-page"><section className="auth-card"><Link className="auth-logo" href="/" aria-label="Moki, inicio"><Image src={logo} alt="Moki by Dekids" priority sizes="210px" /></Link>{children}</section><p className="auth-footer">Una idea. Un paso a la vez.</p></main>;
}
