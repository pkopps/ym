"use client";

import { useState } from "react";

const radiusPresets = [10, 15, 20, 30, 45];

function getRadiusGuidance(serviceRadiusMiles: number): string {
  if (serviceRadiusMiles <= 12) {
    return "Best for dense urban routes, lower drive time, and tighter same-day scheduling.";
  }

  if (serviceRadiusMiles <= 25) {
    return "Balanced for most suburban landscaping businesses that want room to grow without overextending crews.";
  }

  return "Useful for larger territories, but expect more windshield time and wider crew scheduling gaps.";
}

export function ProviderRadiusSettingsCard() {
  const [serviceRadiusMiles, setServiceRadiusMiles] = useState(18);

  return (
    <section className="radius-settings" aria-labelledby="provider-radius-heading">
      <div className="radius-settings__header">
        <div>
          <p className="eyebrow">Service area settings</p>
          <h3 id="provider-radius-heading">
            Choose how far your business will travel from each customer property.
          </h3>
        </div>
        <strong className="radius-settings__value">{serviceRadiusMiles} miles</strong>
      </div>

      <p className="radius-settings__copy">
        YardMatch matches your business against the property address selected on each booking.
        Customers outside this radius will not appear in your serviceable lead pool.
      </p>

      <div className="radius-settings__presets" aria-label="Radius presets">
        {radiusPresets.map((preset) => {
          const isActive = preset === serviceRadiusMiles;
          return (
            <button
              className={`radius-pill${isActive ? " radius-pill--active" : ""}`}
              key={preset}
              onClick={() => setServiceRadiusMiles(preset)}
              type="button"
            >
              {preset} mi
            </button>
          );
        })}
      </div>

      <div className="radius-settings__controls">
        <label className="form-field">
          <span>Drive radius</span>
          <input
            max={60}
            min={5}
            onChange={(event) => setServiceRadiusMiles(Number(event.target.value))}
            type="range"
            value={serviceRadiusMiles}
          />
        </label>
        <label className="form-field">
          <span>Exact miles</span>
          <input
            max={60}
            min={5}
            onChange={(event) => setServiceRadiusMiles(Number(event.target.value))}
            type="number"
            value={serviceRadiusMiles}
          />
        </label>
      </div>

      <div className="radius-settings__summary">
        <div>
          <strong>Match rule</strong>
          <p>Use the booked property address, not the customer account's default home base.</p>
        </div>
        <div>
          <strong>Operational effect</strong>
          <p>{getRadiusGuidance(serviceRadiusMiles)}</p>
        </div>
      </div>
    </section>
  );
}
