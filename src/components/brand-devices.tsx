import { Sprout } from "./brand";

function DeviceBrand() {
  return <div className="device-brand"><Sprout /><strong>NIS Hub</strong></div>;
}

export function BrandDevices({ compact = false }: { compact?: boolean }) {
  return <figure className={compact ? "brand-devices brand-devices-compact" : "brand-devices"} aria-label="NIS Hub on a tablet, laptop, and phone">
    <div className="brand-device device-tablet"><div className="device-screen"><DeviceBrand /></div></div>
    <div className="brand-device device-laptop"><div className="device-screen"><span className="device-camera"/><DeviceBrand /></div><span className="laptop-base" /></div>
    <div className="brand-device device-phone"><div className="device-screen"><span className="device-camera"/><DeviceBrand /></div></div>
    <figcaption className="sr-only">NIS Hub across your learning devices</figcaption>
  </figure>;
}
