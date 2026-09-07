import { useEffect, useRef } from "react";
import type { ChatMessage } from "../../hooks/use-builder";
export function ChatPanel({ messages, input, setInput, busy, test }: { messages: ChatMessage[]; input: string; setInput: (value: string) => void; busy: boolean; test: () => Promise<void> }) {
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [messages, busy]);
  return <aside className="chat-panel" aria-label="Chat de prueba"><div className="chat-title"><h2>Chat de prueba</h2><span className="preview-badge">Ejecución real</span></div>
    <div ref={log} className="chat-messages" role="log" aria-label="Mensajes de prueba" aria-live="polite">
      {messages.map((message, index) => <div key={index} className={`msg ${message.role}`}><div>{message.text}</div>{message.sources?.length ? <section className="message-sources" aria-label="Fuentes consultadas"><strong>Fuentes consultadas</strong><ul>{message.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a><span>{source.pageAge ?? source.age ?? "Sin fecha verificable"}</span></li>)}</ul></section> : null}</div>)}
      {busy && <div className="msg assistant typing" aria-label="Recorriendo la cadena"><span className="dot" /><span className="dot" /><span className="dot" /></div>}
    </div>
    <form className="chat-input-row" onSubmit={(event) => { event.preventDefault(); void test(); }}>
      <label htmlFor="test-input" className="sr-only">Caso de prueba</label><input id="test-input" className="chat-input" placeholder="Escribe un caso de prueba…" value={input} disabled={busy} onChange={(event) => setInput(event.target.value)} />
      <button className="chat-send" disabled={busy} aria-label="Enviar caso de prueba">➤</button>
    </form>
  </aside>;
}
