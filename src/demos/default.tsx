import { WelcomeScreen } from "@/components/welcome-screen";
import { getI18n } from "@/lib/i18n-server";

export default async function ParallaxDemo() {
  const { t } = await getI18n();
  return <WelcomeScreen t={t} configured={false} />;
}
