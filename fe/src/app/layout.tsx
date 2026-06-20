import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "BotHub — Pause the agent. Kill the GPU.",
  description:
    "Ephemeral in billing. Stateful in execution. Freeze VRAM + memory and resume the same step, anywhere.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={jetbrainsMono.variable}>
      <body style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}>
        {children}
      </body>
    </html>
  );
}
