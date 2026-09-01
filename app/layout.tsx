import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LINK STUDY",
  description: "Máquina consultiva para descubrir, simular y medir valor sin alterar la realidad operacional.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
