import type { Dictionary } from "@/lib/i18n";
import { ParallaxComponent } from "./ui/parallax-scrolling";
import { AuthForm } from "./auth-form";
import { WelcomeAuth } from "./welcome-auth";
import { WelcomeDevices } from "./welcome-devices";
import { PublicHeader } from "./public-header";

export function WelcomeScreen({ t, configured }: { t: Dictionary; configured: boolean }) {
  return <ParallaxComponent title={t.welcomeTitle} subtitle={t.welcomeSubtitle}
    header={<PublicHeader />} visual={<WelcomeDevices label={`${t.signup} / ${t.login}`} />}>
    <WelcomeAuth configured={configured}
      signupForm={<AuthForm mode="signup" next="/profile" configured={configured} />}
      loginForm={<AuthForm mode="login" next="/" configured={configured} />} />
  </ParallaxComponent>;
}
