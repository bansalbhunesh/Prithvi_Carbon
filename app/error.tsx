"use client";

/**
 * Route-level error boundary. If any client render throws, the user sees a calm
 * recovery card instead of a blank screen — important for a live demo.
 */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="wrap" style={{ paddingTop: 80, paddingBottom: 80, textAlign: "center" }}>
      <span className="eyebrow">Something interrupted</span>
      <h1 className="page" style={{ marginTop: 8 }}>Let&apos;s try that again.</h1>
      <p className="lead" style={{ margin: "0 auto 22px" }}>
        A part of the page hit an unexpected error. Your saved data is safe in this
        browser — reloading the view usually fixes it.
      </p>
      <button className="btn" onClick={reset}>Reload the dashboard</button>
    </main>
  );
}
