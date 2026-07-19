"use client";

import { TranslationKey } from "@yardmatch/i18n";
import { useI18n } from "@yardmatch/i18n/react";
import { useState } from "react";

const radiusPresets = [10, 15, 20, 30, 45];

function getRadiusGuidanceKey(serviceRadiusMiles: number): TranslationKey {
  if (serviceRadiusMiles <= 12) {
    return "provider_radius.guidance.dense";
  }

  if (serviceRadiusMiles <= 25) {
    return "provider_radius.guidance.balanced";
  }

  return "provider_radius.guidance.wide";
}

export function ProviderRadiusSettingsCard() {
  const i18n = useI18n();
  const [serviceRadiusMiles, setServiceRadiusMiles] = useState(18);

  return (
    <section className="radius-settings" aria-labelledby="provider-radius-heading">
      <div className="radius-settings__header">
        <div>
          <p className="eyebrow">{i18n.t("provider_radius.eyebrow")}</p>
          <h3 id="provider-radius-heading">
            {i18n.t("provider_radius.title")}
          </h3>
        </div>
        <strong className="radius-settings__value">
          {i18n.t("provider_radius.value_miles", { count: serviceRadiusMiles })}
        </strong>
      </div>

      <p className="radius-settings__copy">
        {i18n.t("provider_radius.copy")}
      </p>

      <div className="radius-settings__presets" aria-label={i18n.t("provider_radius.presets_aria")}>
        {radiusPresets.map((preset) => {
          const isActive = preset === serviceRadiusMiles;
          return (
            <button
              className={`radius-pill${isActive ? " radius-pill--active" : ""}`}
              key={preset}
              onClick={() => setServiceRadiusMiles(preset)}
              type="button"
            >
              {i18n.t("provider_radius.preset_miles", { count: preset })}
            </button>
          );
        })}
      </div>

      <div className="radius-settings__controls">
        <label className="form-field">
          <span>{i18n.t("provider_radius.drive_radius")}</span>
          <input
            max={60}
            min={5}
            onChange={(event) => setServiceRadiusMiles(Number(event.target.value))}
            type="range"
            value={serviceRadiusMiles}
          />
        </label>
        <label className="form-field">
          <span>{i18n.t("provider_radius.exact_miles")}</span>
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
          <strong>{i18n.t("provider_radius.match_rule.title")}</strong>
          <p>{i18n.t("provider_radius.match_rule.body")}</p>
        </div>
        <div>
          <strong>{i18n.t("provider_radius.operational_effect.title")}</strong>
          <p>{i18n.t(getRadiusGuidanceKey(serviceRadiusMiles))}</p>
        </div>
      </div>
    </section>
  );
}
