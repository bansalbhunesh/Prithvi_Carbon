import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Prithvi — your carbon footprint, the Indian way",
  description:
    "Track, understand and reduce your carbon footprint with India-calibrated, auditable emission math.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div className="wrap topbar-in">
            <a href="/" className="brand" style={{ textDecoration: "none" }}>
              <span className="dot" />
              Prithvi
              <span className="sub">carbon · India</span>
            </a>
            <nav style={{ display: "flex", gap: 18 }}>
              <a className="navlink" href="/">Dashboard</a>
              <a className="navlink" href="/methodology">Methodology</a>
            </nav>
          </div>
        </header>
        {children}
        <footer>
          Prithvi · India-calibrated carbon math · CEA v21.0 grid factor.{" "}
          <a href="/methodology">See every factor &amp; its source →</a>
        </footer>
      </body>
    </html>
  );
}
