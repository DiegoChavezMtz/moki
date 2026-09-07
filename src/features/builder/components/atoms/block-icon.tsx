export function BlockIcon({ icon, color }: { icon: string; color: string }) {
  return <span className="step-swatch" style={{ background: color }} aria-hidden="true">{icon}</span>;
}
