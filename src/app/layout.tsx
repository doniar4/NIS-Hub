import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NIS Hub",
  description: "A personal study space for NIS students.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
