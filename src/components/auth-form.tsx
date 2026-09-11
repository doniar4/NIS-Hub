import Link from "next/link";
import { authenticate } from "@/app/actions/auth";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/fields";

export function AuthForm({ mode, next, configured }: { mode: "login" | "signup"; next: string; configured: boolean }) {
  const signup = mode === "signup";
  return <ActionForm action={authenticate.bind(null, mode)} disabled={!configured} label={signup ? "Создать аккаунт" : "Войти"} className="mt-8 max-w-md space-y-5 border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8">
    <input name="next" type="hidden" value={next} />
    <Field label="Email" name="email" type="email" autoComplete="email" required maxLength={254} />
    <Field label="Пароль" name="password" type="password" autoComplete={signup ? "new-password" : "current-password"} required minLength={8} maxLength={128} />
    <p className="text-sm text-[var(--muted)]">Минимум 8 символов.</p>
    {signup && <label className="flex items-start gap-3 text-sm leading-6"><input className="mt-1 h-5 w-5 shrink-0" type="checkbox" name="terms" required /><span>Я принимаю <Link className="underline" href="/terms">условия использования</Link> и ознакомился с <Link className="underline" href="/privacy">политикой конфиденциальности</Link>.</span></label>}
  </ActionForm>;
}
