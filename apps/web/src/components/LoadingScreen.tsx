export function LoadingScreen({ label = "Loading YardMatch..." }: { label?: string }) {
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <div className="loading-orb" />
      <p>{label}</p>
    </div>
  );
}
