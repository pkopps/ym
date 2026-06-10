"use client";

import { useEffect, useMemo, useState } from "react";

export function HomeServiceScroller({ services }: { services: readonly string[] }) {
  const [state, setState] = useState({
    activeIndex: 0,
    isAnimating: false
  });
  const nextIndex = useMemo(
    () => (state.activeIndex + 1) % services.length,
    [state.activeIndex, services.length]
  );
  const currentService = services[state.activeIndex];
  const nextService = services[nextIndex];

  useEffect(() => {
    let advanceTimeoutId: ReturnType<typeof setTimeout> | undefined;

    const intervalId = setInterval(() => {
      setState((currentState) => ({
        ...currentState,
        isAnimating: true
      }));
      advanceTimeoutId = setTimeout(() => {
        setState((currentState) => ({
          activeIndex: (currentState.activeIndex + 1) % services.length,
          isAnimating: false
        }));
      }, 420);
    }, 3000);

    return () => {
      clearInterval(intervalId);
      window.clearTimeout(advanceTimeoutId);
    };
  }, [services.length]);

  return (
    <span className={`home-service-scroller${state.isAnimating ? " is-animating" : ""}`}>
      <span className="home-service-scroller__window" aria-live="polite">
        <span className="home-service-scroller__track">
          <span
            className={`home-service-scroller__item home-service-scroller__item--current${isWinterService(currentService) ? " home-service-scroller__item--winter" : ""}`}
          >
            {currentService}
          </span>
          <span
            className={`home-service-scroller__item home-service-scroller__item--next${isWinterService(nextService) ? " home-service-scroller__item--winter" : ""}`}
          >
            {nextService}
          </span>
        </span>
      </span>
    </span>
  );
}

function isWinterService(serviceLabel: string): boolean {
  return serviceLabel.trim().toLowerCase() === "snow shoveling";
}
