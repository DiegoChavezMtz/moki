import type { InputHTMLAttributes } from "react";
export function AuthField({ label, id, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string }) {
  return <div className="auth-field"><label htmlFor={id}>{label}</label><input id={id} {...props} /></div>;
}
