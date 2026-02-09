import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SankofaWire — Embedded Diagnostics",
  description: "Fast, grounded diagnostics for ESP32, STM32, and Arduino.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen kente-bg antialiased">
        <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
            <span className="text-lg font-semibold tracking-tight text-[var(--text)]">
              SankofaWire
            </span>
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-[var(--text-muted)] sm:inline">
                Embedded diagnostics
              </span>
              <div className="flag-strip" aria-hidden />
            </div>
          </div>
        </header>
        {children}
        <footer className="mt-8 border-t bg-white/50 py-4">
          <div className="mx-auto max-w-7xl px-4 text-center text-xs text-[var(--text-muted)] sm:px-6">
            Built with Sankofa mindset: learn fast, wire right.
          </div>
        </footer>
      </body>
    </html>
  );
}
