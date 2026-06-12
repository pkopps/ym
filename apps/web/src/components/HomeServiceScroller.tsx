"use client";

import { useEffect, useRef, useState } from "react";

export function HomeServiceScroller({ services }: { services: readonly string[] }) {
  const [state, setState] = useState({
    currentIndex: 0,
    incomingIndex: services.length > 1 ? 1 : undefined as number | undefined,
    isAnimating: false
  });
  const advanceTimeoutRef = useRef<number | undefined>(undefined);
  const settleTimeoutRef = useRef<number | undefined>(undefined);
  const currentService = services[state.currentIndex];
  const incomingService =
    state.incomingIndex !== undefined ? services[state.incomingIndex] : undefined;

  useEffect(() => {
    if (services.length <= 1) {
      return undefined;
    }

    function clearTimers() {
      if (advanceTimeoutRef.current !== undefined) {
        window.clearTimeout(advanceTimeoutRef.current);
      }
      if (settleTimeoutRef.current !== undefined) {
        window.clearTimeout(settleTimeoutRef.current);
      }
    }

    function queueAdvance() {
      advanceTimeoutRef.current = window.setTimeout(() => {
        setState((currentState) => {
          if (currentState.isAnimating) {
            return currentState;
          }

          return {
            ...currentState,
            incomingIndex: (currentState.currentIndex + 1) % services.length,
            isAnimating: true
          };
        });
        settleTimeoutRef.current = window.setTimeout(() => {
          setState((currentState) => {
            const nextIndex = currentState.incomingIndex ?? currentState.currentIndex;
            return {
              currentIndex: nextIndex,
              incomingIndex: undefined,
              isAnimating: false
            };
          });
          queueAdvance();
        }, 420);
      }, 3000);
    }

    clearTimers();
    queueAdvance();

    return () => {
      clearTimers();
    };
  }, [services.length]);

  return (
    <span className={`home-service-scroller${state.isAnimating ? " is-animating" : ""}`}>
      <span aria-atomic="true" aria-live="polite" className="visually-hidden">
        {currentService}
      </span>
      <span aria-hidden="true" className="home-service-scroller__window">
        <span
          className={`home-service-scroller__item home-service-scroller__item--active${isWinterService(currentService) ? " home-service-scroller__item--winter" : ""}`}
        >
          {currentService}
        </span>
        {incomingService ? (
          <span
            className={`home-service-scroller__item home-service-scroller__item--incoming${isWinterService(incomingService) ? " home-service-scroller__item--winter" : ""}`}
          >
            {incomingService}
          </span>
        ) : null}
      </span>
    </span>
  );
}

function isWinterService(serviceLabel: string): boolean {
  return serviceLabel.trim().toLowerCase() === "snow shoveling";
}
