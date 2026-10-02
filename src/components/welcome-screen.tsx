import type { Dictionary } from "@/lib/i18n";
import { ParallaxComponent } from "./ui/parallax-scrolling";
import { AuthForm } from "./auth-form";
import { WelcomeAuth } from "./welcome-auth";
import { WelcomeDevices } from "./welcome-devices";
import { PublicHeader } from "./public-header";

export function WelcomeScreen({ t, configured, authMode = "signup", loginNext = "/", confirmationFailed = false, callbackFailed = false, googleEnabled = false, appleEnabled = false }: {
  t: Dictionary;
  configured: boolean;
  authMode?: "signup" | "login";
  loginNext?: string;
  confirmationFailed?: boolean;
  callbackFailed?: boolean;
  googleEnabled?: boolean;
  appleEnabled?: boolean;
}) {
  return <ParallaxComponent title={t.welcomeTitle} subtitle={t.welcomeSubtitle}
    header={<PublicHeader />} visual={<WelcomeDevices label={`${t.signup} / ${t.login}`} />}>
    <WelcomeAuth configured={configured} initialMode={authMode} confirmationFailed={confirmationFailed} callbackFailed={callbackFailed} googleEnabled={googleEnabled} appleEnabled={appleEnabled}
      signupForm={<AuthForm mode="signup" next="/profile" configured={configured} />}
      loginForm={<AuthForm mode="login" next={loginNext} configured={configured} />} />
  </ParallaxComponent>;
}
