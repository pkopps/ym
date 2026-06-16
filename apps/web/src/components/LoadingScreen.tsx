import { LawnMowerLoader } from "./LawnMowerLoader";

export function LoadingScreen({ label = "Loading YardMatch..." }: { label?: string }) {
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <LawnMowerLoader />
      <p>{label}</p>
    </div>
  );
}
