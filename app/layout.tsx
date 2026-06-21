import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Prithvi — your carbon footprint, the Indian way",
  description:
    "Track, understand and reduce your carbon footprint with India-calibrated, auditable emission math. Snap a bill, Gemini reads it, deterministic engine does the CO2 math.",
  keywords: ["carbon footprint", "India", "climate", "emissions tracker", "CO2", "Gemini", "PromptWars"],
  authors: [{ name: "Prithvi" }],
  openGraph: {
    title: "Prithvi — your carbon footprint, the Indian way",
    description: "AI reads your bill. Audited math calculates your CO2. India-specific emission factors, not Western defaults.",
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Prithvi — Carbon Tracker for India",
    description: "Snap a bill, Gemini reads it, deterministic engine does the CO2 math. Track, understand, reduce.",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#126844",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">Skip to content</a>
        <header className="topbar">
          <div className="wrap topbar-in">
            <a href="/" className="brand" style={{ textDecoration: "none" }}>
              <span className="dot" aria-hidden="true" />
              Prithvi
              <span className="sub">carbon · India</span>
            </a>
            <nav style={{ display: "flex", gap: 18, alignItems: "center" }}>
              <a className="navlink" href="/">Dashboard</a>
              <a className="navlink" href="/methodology">Methodology</a>
            </nav>
          </div>
        </header>
        <div id="main">
          {children}
        </div>
        <footer>
          <div className="footer-badge">
            Built for <b>Google PromptWars · Challenge 3</b>
          </div>
          Prithvi · India-calibrated carbon math · CEA v21.0 grid factor ·{" "}
          <a href="/methodology">See every factor &amp; its source</a>
        </footer>
      </body>
    </html>
  );
}
