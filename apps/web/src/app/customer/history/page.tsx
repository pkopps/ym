"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CustomerHistoryPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/customer/dashboard?view=history");
  }, [router]);

  return (
    <main className="container stack-lg">
      <section className="card">
        <h2>Redirecting…</h2>
        <p>Taking you to past visits.</p>
      </section>
    </main>
  );
}
