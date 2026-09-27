import VelarisDemo from "@/components/ui/demo";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Velaris Demo — NIS Hub",
  description: "Living gradients in motion with Velaris",
};

export default function LiquidGlassPage() {
  return <main className="p-6"><VelarisDemo /></main>;
}
