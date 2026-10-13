"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  createInstallController,
  type InstallController,
} from "@/lib/install-awareness";
import { InstallGuide } from "./install-guide";

const InstallContext = createContext<InstallController | null>(null);
export function useInstall() {
  const controller = useContext(InstallContext);
  if (!controller) throw new Error("InstallProvider is required");
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot,
    controller.serverSnapshot,
  );
  return { state, controller };
}
function GuideHost() {
  const { state, controller } = useInstall();
  return state.guideOpen ? (
    <InstallGuide state={state} controller={controller} />
  ) : null;
}
export function InstallProvider({ children }: { children: ReactNode }) {
  const [controller] = useState(() => createInstallController()),
    path = usePathname();
  useEffect(() => controller.mount(window), [controller]);
  useEffect(() => controller.routeChanged(path), [controller, path]);
  return (
    <InstallContext value={controller}>
      {children}
      <GuideHost />
    </InstallContext>
  );
}
