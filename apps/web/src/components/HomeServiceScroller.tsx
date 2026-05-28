"use client";

import { useEffect, useMemo, useState } from "react";

export function HomeServiceScroller({ services }: { services: readonly string[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const nextIndex = useMemo(() => (activeIndex + 1) % services.length, [activeIndex, services.length]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const intervalId = setInterval(() => {
      setIsAnimating(true);
      timeoutId = setTimeout(() => {
        setActiveIndex((currentIndex) => (currentIndex + 1) % services.length);
        setIsAnimating(false);
      }, 450);
    }, 3000);

    return () => {
      clearInterval(intervalId);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [services.length]);

  return (
    <span className={`home-service-scroller ${isAnimating ? "is-animating" : ""}`}>
      <span className="home-service-scroller__window">
        <span className="home-service-scroller__item home-service-scroller__item--current">
          {services[activeIndex]}
        </span>
        <span className="home-service-scroller__item home-service-scroller__item--next">
          {services[nextIndex]}
        </span>
      </span>
    </span>
  );
}
