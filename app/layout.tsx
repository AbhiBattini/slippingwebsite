import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "slippage-labs · prediction market slippage",
  description:
    "Paste a Polymarket or Kalshi URL and an order size. See what you'd actually pay.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
