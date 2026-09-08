"use client";
import { useEffect, useRef, useState } from "react";
const examples = [
  { label: "Resumir un documento", icon: "▤", file: "notas-del-proyecto.txt", input: "El prototipo está listo. Las pruebas empiezan el lunes. Falta confirmar quién coordina las entrevistas.", instruction: "Resume el avance y destaca el siguiente paso.", title: "Lo importante, sin las vueltas.", result: "El prototipo está listo para comenzar las pruebas el lunes.", detail: "Siguiente paso", action: "Confirmar a la persona responsable de coordinar las entrevistas.", tag: "Resumen del proyecto" },
  { label: "Explorar una idea", icon: "✳", file: "una-idea-por-explorar.txt", input: "Quiero organizar un taller para que mi equipo aprenda a usar IA en tareas cotidianas.", instruction: "Propón una estructura sencilla para el taller.", title: "De una chispa a un plan.", result: "Un taller práctico en tres momentos: descubrir, experimentar y compartir.", detail: "Primer ejercicio", action: "Elegir una tarea cotidiana y escribir las instrucciones para que un agente ayude a resolverla.", tag: "Propuesta de taller" },
  { label: "Preparar un reporte", icon: "↗", file: "avance-semanal.txt", input: "Esta semana terminamos el diseño y revisamos los textos. La integración sigue pendiente porque falta el acceso.", instruction: "Convierte estas notas en un reporte breve.", title: "Tus notas, listas para compartir.", result: "Completado: diseño y revisión de textos. Pendiente: integración.", detail: "Bloqueo por resolver", action: "Conseguir el acceso necesario para continuar con la integración.", tag: "Reporte semanal" },
];
export function AgentDemo() {
  const [selected, setSelected] = useState(0);
  const [replay, setReplay] = useState(0);
  const sceneRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.15 });
    observer.observe(scene);
    return () => observer.disconnect();
  }, [selected, replay]);
  const example = examples[selected];
  return <section className="landing-demo" id="en-accion" aria-labelledby="landing-demo-title">
    <div className="landing-demo-top"><div><span className="landing-demo-kicker"><i /> EL MOMENTO EN QUE TODO CONECTA</span><h2 id="landing-demo-title">Una idea entra.<br />Algo increíble sale.</h2></div><p>Así puede verse tu próximo agente.<br /><span>Elige una idea y sigue su recorrido.</span></p></div>
    <div className="landing-demo-options" role="group" aria-label="Elige un ejemplo">{examples.map((item, index) => <button key={item.label} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)}><span aria-hidden="true">{item.icon}</span>{item.label}<span className="landing-option-arrow" aria-hidden="true">↗</span></button>)}</div>
    <div className="landing-demo-window"><div className="landing-window-bar"><span className="landing-window-dots" aria-hidden="true"><i /><i /><i /></span><span>Mi primer agente <span className="landing-window-slash">/</span> <b>{example.tag}</b></span><span className="landing-preview-label">VISTA DE EJEMPLO</span></div>
      <div ref={sceneRef} className={`landing-demo-scene${visible ? " is-visible" : ""}`} key={`${selected}-${replay}`}>
        <div className="landing-input"><p className="landing-panel-label"><span>01</span> TU PUNTO DE PARTIDA</p><div className="landing-file"><span aria-hidden="true">▤</span><div>{example.file}<small>Documento de ejemplo</small></div></div><p className="landing-input-text">“{example.input}”</p><div className="landing-instruction"><span aria-hidden="true">↳</span>{example.instruction}</div></div>
        <div className="landing-flow"><p className="landing-panel-label"><span>02</span> TU AGENTE EN ACCIÓN</p><div className="landing-flow-nodes">{["Leer documento", "Pensar", "Escribir"].map((block, index) => <div className={`landing-flow-node landing-node-${index}`} key={block}><span className="landing-node-icon" aria-hidden="true">{["▤", "✳", "↗"][index]}</span><div><b>{block}</b><small>{["Encuentra lo importante", "Conecta las ideas", "Dale forma al resultado"][index]}</small></div><span className="landing-node-check" aria-hidden="true">✓</span></div>)}</div><span className="landing-flow-caption">Tres pasos. Una idea que avanza.</span></div>
        <div className="landing-output" aria-live="polite" aria-atomic="true"><p className="landing-panel-label"><span>03</span> EL RESULTADO</p><div className="landing-result-card"><div className="landing-result-status"><span>✳ MOKI</span><span>✓ Listo</span></div><h3>{example.title}</h3><p>{example.result}</p><div className="landing-result-next"><b>{example.detail}</b><p>{example.action}</p></div><span className="landing-result-bottom">Tu idea, un paso más allá. <span aria-hidden="true">↗</span></span></div></div>
      </div>
      <div className="landing-demo-bottom"><span><i /> Demostración ilustrativa · respuestas de ejemplo</span><button type="button" onClick={() => setReplay(value => value + 1)} aria-label="Repetir animación del ejemplo"><span aria-hidden="true">↻</span> Repetir recorrido</button></div>
    </div><div className="landing-demo-footnote"><span aria-hidden="true">↳</span> Tú pones la intención. Moki conecta los pasos.</div>
  </section>;
}
