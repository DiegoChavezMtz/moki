import Image from "next/image";
import Link from "next/link";
import logo from "../../../../../marca/MokiLogo2.png";
import "../../landing.css";

const capabilities = [
  ["1", "Arma tu cadena", "Combina bloques para pensar, buscar, leer, calcular y responder."],
  ["2", "Pruébala con un caso real", "Da una entrada, adjunta los documentos que necesites y revisa el resultado."],
  ["3", "Comparte y adapta", "Explora el Marketplace o crea una copia editable de un agente de otra persona."],
];

export function Landing() {
  return <main className="landing">
    <header className="landing-header"><Link href="/" className="landing-logo" aria-label="Moki, inicio"><Image src={logo} alt="Moki by Dekids" priority sizes="154px" /></Link><nav aria-label="Navegación principal"><Link href="/login">Iniciar sesión</Link><Link className="landing-nav-cta" href="/registro">Crear cuenta</Link></nav></header>
    <section className="landing-hero"><p className="landing-eyebrow">Constructor de agentes en español</p><h1>Convierte un proceso de trabajo en pasos claros.</h1><p>Con Moki creas agentes sencillos que consultan fuentes, leen documentos, hacen cálculos y preparan una respuesta. Sin código, un paso a la vez.</p><div className="landing-actions"><Link className="landing-primary" href="/registro">Crear mi cuenta</Link><Link className="landing-secondary" href="/login">Ya tengo cuenta</Link></div></section>
    <section className="landing-capabilities" aria-labelledby="como-funciona"><div><p className="landing-eyebrow">Cómo funciona</p><h2 id="como-funciona">De una idea a una cadena que puedes probar.</h2></div><ol>{capabilities.map(([number, title, description]) => <li key={number}><span aria-hidden="true">{number}</span><h3>{title}</h3><p>{description}</p></li>)}</ol></section>
    <section className="landing-closing"><div><p className="landing-eyebrow">Empieza aquí</p><h2>Tu primer agente puede resolver una parte real de tu trabajo hoy.</h2></div><Link className="landing-primary" href="/registro">Empezar a crear</Link></section>
    <footer>Una idea. Un paso a la vez.</footer>
  </main>;
}
