import type { InputHTMLAttributes } from "react";

export function Field({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="block"><span className="field-label">{label}</span><input className="field" {...props} /></label>;
}
export function SelectField({ label, name, options, value, defaultValue = "", required = false, empty = "Не выбран" }: { label: string; name: string; options: { id: string; name: string }[]; value?: string | null; defaultValue?: string; required?: boolean; empty?: string }) {
  return <label className="block"><span className="field-label">{label}</span><select className="field" defaultValue={value ?? defaultValue} name={name} required={required}><option value="">{empty}</option>{options.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>;
}
