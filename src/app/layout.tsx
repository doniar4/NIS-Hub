import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NIS Library",
  description: "Student-focused digital learning space — development prototype.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
