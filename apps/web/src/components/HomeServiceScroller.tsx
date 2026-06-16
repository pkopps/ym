"use client";

import { useEffect, useState } from "react";

const ROTATION_INTERVAL_MS = 3200;

export function HomeServiceScroller({ services }: { services: readonly string[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentService = services[currentIndex];

  useEffect(() => {
    if (services.length <= 1) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setCurrentIndex((current) => (current + 1) % services.length);
    }, ROTATION_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [services]);

  return (
    <span className="home-service-scroller">
      <span aria-atomic="true" aria-live="polite" className="visually-hidden">
        {currentService}
      </span>
      <span aria-hidden="true" className="home-service-scroller__window">
        <span
          className={`home-service-scroller__item${isWinterService(currentService) ? " home-service-scroller__item--winter" : ""}`}
          key={currentService}
        >
          {currentService}
        </span>
      </span>
    </span>
  );
}

function isWinterService(serviceLabel: string): boolean {
  return serviceLabel.trim().toLowerCase() === "snow shoveling";
}
