import type { Metadata } from "next";
import { Inter, Syne } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: '--font-inter' });
const syne = Syne({ subsets: ["latin"], variable: '--font-syne' });

export const metadata: Metadata = {
  title: "StormGuest",
  description: "AI-Powered Guest Experience Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} ${syne.variable}`}>
      <body className="antialiased bg-stone-950 text-stone-50 min-h-screen">
        {children}
      </body>
    </html>
  );
}
