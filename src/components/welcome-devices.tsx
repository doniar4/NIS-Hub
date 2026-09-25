import Image from "next/image";
import { Sprout } from "./brand";

function AnimatedScreen({ device }: { device: "tablet" | "laptop" | "phone" }) {
  return <div className={`welcome-device-screen welcome-device-screen-${device}`}>
    <div className="screen-wallpaper" aria-hidden="true">
      <span className="screen-wave screen-wave-blue" />
      <span className="screen-wave screen-wave-mint" />
      <span className="screen-wave screen-wave-violet" />
    </div>
    <div className="welcome-device-brand"><Sprout /><span>NIS Hub</span></div>
    {device !== "tablet" && <span className="welcome-device-notch" />}
  </div>;
}

export function WelcomeDevices({ label }: { label: string }) {
  return <a href="#welcome-auth" className="welcome-devices" aria-label={`NIS Hub: ${label}`}>
    <div className="welcome-devices-scene" aria-hidden="true">
      {(["tablet", "laptop", "phone"] as const).map(device => <div key={device} className={`welcome-hardware welcome-hardware-${device}`}>
        <Image className="welcome-devices-photo" src="/images/welcome-devices.webp" alt="" width={1536} height={1024}
          sizes="(max-width: 640px) 100vw, (max-width: 1200px) 85vw, 1120px" preload={device === "laptop"} />
        <AnimatedScreen device={device} />
      </div>)}
    </div>
  </a>;
}
