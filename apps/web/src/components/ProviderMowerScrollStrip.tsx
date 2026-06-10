"use client";

import { useEffect, useRef, useState } from "react";

const mowerTravelPercent = 148;

export function ProviderMowerScrollStrip() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const progressRef = useRef(0);
  const lastScrollYRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const [mowerOffsetPercent, setMowerOffsetPercent] = useState(112);

  useEffect(() => {
    lastScrollYRef.current = window.scrollY;

    function commitOffset() {
      const wrappedProgress = progressRef.current % mowerTravelPercent;
      setMowerOffsetPercent(112 - wrappedProgress);
      frameRef.current = null;
    }

    function handleScroll() {
      const section = sectionRef.current;
      const nextScrollY = window.scrollY;
      const scrollDelta = Math.abs(nextScrollY - lastScrollYRef.current);
      lastScrollYRef.current = nextScrollY;

      if (!section || scrollDelta === 0) {
        return;
      }

      const bounds = section.getBoundingClientRect();
      const isActive = bounds.top < window.innerHeight && bounds.bottom > 0;
      if (!isActive) {
        return;
      }

      progressRef.current += scrollDelta * 0.09;
      if (frameRef.current === null) {
        frameRef.current = window.requestAnimationFrame(commitOffset);
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return (
    <section className="provider-mower-strip" ref={sectionRef}>
      <div className="container provider-mower-strip__inner">
        <div className="provider-mower-strip__track" aria-hidden="true">
          <div className="provider-mower-strip__grass provider-mower-strip__grass--back" />
          <div
            className="provider-mower-strip__mower"
            style={{ transform: `translateX(${mowerOffsetPercent}%)` }}
          >
            <img
              alt=""
              className="provider-mower-strip__mower-image"
              src="/media/landscaping-tools/lawn-mower.png"
            />
          </div>
          <div className="provider-mower-strip__grass provider-mower-strip__grass--front" />
        </div>
      </div>
    </section>
  );
}
