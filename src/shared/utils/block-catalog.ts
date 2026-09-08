/** Datos visuales del catálogo cerrado de bloques, compartidos por Constructor y Marketplace. */
export const blockCatalog = [
  { type: "pensar", label: "Pensar / decidir", color: "#6C63FF", icon: "🧠", placeholder: "¿Qué debe decidir este paso?", description: "Analiza la información o elige una prioridad antes de continuar." },
  { type: "buscar-web", label: "Buscar en internet", color: "#1F9E89", icon: "🔎", placeholder: "¿Qué debe buscar?", description: "Encuentra fuentes verificables en internet para usar en tu cadena." },
  { type: "leer-documento", label: "Leer un documento", color: "#C98A2A", icon: "📄", placeholder: "¿Qué documento debe leer y qué debe sacar de ahí?", description: "Extrae la información que necesitas de un PDF, DOCX o TXT." },
  { type: "calcular", label: "Hacer un cálculo", color: "#D4553E", icon: "🧮", placeholder: "¿Qué debe calcular?", description: "Resuelve una operación con un resultado matemático exacto." },
  { type: "escribir", label: "Escribir / responder", color: "#3D7A5C", icon: "✍️", placeholder: "¿Cómo debe redactar la respuesta?", description: "Redacta una respuesta clara con lo obtenido en los pasos anteriores." },
] as const;
