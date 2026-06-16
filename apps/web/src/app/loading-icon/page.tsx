import type { Metadata } from "next";
import { LawnMowerLoader } from "../../components/LawnMowerLoader";
import { LoadingScreen } from "../../components/LoadingScreen";

export const metadata: Metadata = {
  title: "Loading Icon Preview",
  description: "Preview the GreenRain lawn mower loading icon."
};

export default function LoadingIconPage() {
  return (
    <main className="container stack-lg loading-icon-preview">
      <section className="page-hero">
        <h1>Lawn mower loading icon</h1>
        <p>Bird&apos;s-eye mower orbit with a spinning blade.</p>
      </section>

      <section className="grid-two">
        <article className="card loading-icon-preview__card">
          <strong>Loader only</strong>
          <div className="loading-icon-preview__stage">
            <LawnMowerLoader />
          </div>
        </article>

        <article className="card loading-icon-preview__card">
          <strong>Shared loading screen</strong>
          <div className="loading-icon-preview__screen">
            <LoadingScreen label="Loading GreenRain..." />
          </div>
        </article>
      </section>
    </main>
  );
}
