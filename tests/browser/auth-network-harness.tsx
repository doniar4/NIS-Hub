import { createRoot } from "react-dom/client";
import { LocaleProvider } from "../../src/components/locale-provider";
import { ParallaxComponent } from "../../src/components/ui/parallax-scrolling";
import { WelcomeAuth } from "../../src/components/welcome-auth";
import { SmoothScroll } from "../../src/components/smooth-scroll";
import { ActionForm } from "../../src/components/action-form";
import { Field } from "../../src/components/fields";
import { ThemeControl } from "../../src/components/theme-control";
import type { ActionState } from "../../src/lib/action-state";
async function authenticate(_state: ActionState, form: FormData) {
  const response = await fetch("/fixture/authenticate", {
    method: "POST",
    body: JSON.stringify({
      email: form.get("email"),
      password: form.get("password"),
      mode: form.get("mode"),
      terms: form.get("terms"),
    }),
  });
  return (await response.json()) as ActionState;
}
const form = (mode: "login" | "signup") => (
  <ActionForm
    action={authenticate}
    label={mode === "login" ? "Войти" : "Зарегистрироваться"}
    className="auth-form"
    submitVariant="flame"
  >
    <input type="hidden" name="mode" value={mode} />
    <Field
      label="Email"
      name="email"
      type="email"
      required
      autoComplete="email"
    />
    <Field
      label="Пароль"
      name="password"
      type="password"
      required
      minLength={8}
    />
    {mode === "signup" && (
      <label>
        <input type="checkbox" name="terms" required />
        Принимаю условия и политику конфиденциальности
      </label>
    )}
  </ActionForm>
);
const entry = new URLSearchParams(location.search).has("auth");
createRoot(document.getElementById("root")!).render(
  <LocaleProvider locale="ru">
    <SmoothScroll />
    <ParallaxComponent
      authEntry={entry}
      title="NIS Hub"
      subtitle="Учёба"
      header={
        <header className="public-header">
          <ThemeControl />
        </header>
      }
      visual={<div className="welcome-devices-scene" />}
    >
      <WelcomeAuth
        configured
        initialMode="login"
        loginNext="/schedule"
        loginForm={form("login")}
        signupForm={form("signup")}
      />
    </ParallaxComponent>
  </LocaleProvider>,
);
