import Link from "next/link";
import { getI18n } from "@/lib/i18n-server";
import { AuthForm } from "./auth-form";
import { BrandDevices } from "./brand-devices";
import { Notice } from "./ui";
import { PublicHeader } from "./public-header";

export async function AuthExperience({
  mode,
  next,
  configured,
  confirmationFailed = false,
}: {
  mode: "login" | "signup";
  next: string;
  configured: boolean;
  confirmationFailed?: boolean;
}) {
  const { t } = await getI18n();
  const signup = mode === "signup";

  return <div className="public-experience auth-experience">
    <PublicHeader compact />
    <main id="main" className="auth-layout">
      <section className="auth-form-pane" aria-labelledby="auth-title">
        <div className="auth-form-inner">
          <p className="auth-kicker">NIS Hub</p>
          <h1 id="auth-title">{signup ? t.signup : t.login}</h1>
          <p className="auth-subtitle">{signup ? t.signupHint : t.loginHint}</p>
          {!configured && <Notice>{t.authNotConfigured}</Notice>}
          {confirmationFailed && <p className="form-error" role="alert">{t.confirmFailed}</p>}
          <AuthForm mode={mode} next={next} configured={configured}/>
          <p className="auth-switch">{signup ? t.hasAccount : t.noAccount}{" "}<Link href={signup ? "/login" : "/signup"}>{signup ? t.login : t.signup}</Link></p>
        </div>
      </section>
      <section className="auth-visual-pane" aria-label="NIS Hub">
        <h2>{t.authHeroPrefix}<span className="auth-word-learning">{t.authHeroLearning}</span>, <span className="auth-word-planning">{t.authHeroPlanning}</span>{t.authHeroAnd}<span className="auth-word-growth">{t.authHeroGrowth}</span>{t.authHeroSuffix}</h2>
        <BrandDevices compact />
      </section>
    </main>
  </div>;
}
