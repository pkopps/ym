"use client";

import { useEffect } from "react";
import "./globals.css";

// Replaces the root layout when the layout itself fails, so translations are not available here.
const copy = {
  en: {
    title: "Something went wrong",
    body: "YardMatch ran into a problem while loading. Try again in a moment.",
    retry: "Try again",
    reference: "If you contact support, mention reference"
  },
  es: {
    title: "Algo salió mal",
    body: "YardMatch tuvo un problema al cargar. Inténtalo de nuevo en un momento.",
    retry: "Intentar de nuevo",
    reference: "Si contactas a soporte, menciona la referencia"
  }
};

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const spanish = typeof window !== "undefined" &&
    (window.location.pathname.startsWith("/es") || window.navigator.language.toLowerCase().startsWith("es"));
  const text = spanish ? copy.es : copy.en;

  return (
    <html lang={spanish ? "es" : "en"}>
      <body>
        <main className="page-error-state">
          <section className="card page-error-state__card" role="alert">
            <h1>{text.title}</h1>
            <p>{text.body}</p>
            <div className="cta-row">
              <button className="button" type="button" onClick={reset}>{text.retry}</button>
            </div>
            {error.digest ? <p className="page-error-state__reference">{text.reference} {error.digest}.</p> : null}
          </section>
        </main>
      </body>
    </html>
  );
}
