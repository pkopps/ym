"use client";
import { useEffect, useRef, type ReactNode } from "react";
export function WorkspaceSection({id, title, children, defaultOpen = false}: {id: string; title: string; children: ReactNode; defaultOpen?: boolean}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const reveal = () => { if (location.hash === `#${id}` && ref.current) { ref.current.open = true; ref.current.scrollIntoView({block: "start"}); } };
    reveal(); window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, [id]);
  return <details ref={ref} id={id} open={defaultOpen} className="workspace-section">
    <summary>{title}</summary><div className="stack-lg">{children}</div>
  </details>;
}
