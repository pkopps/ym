"use client";

import type { CrewMatchSummary } from "@yardmatch/contracts";
import { useI18n } from "@yardmatch/i18n/react";

/** What accepted crew need on site: where, how to get in, what the customer asked for, and the photo steps. */
export function CrewSiteInstructions({ match }: { match: CrewMatchSummary }) {
  const i18n = useI18n();
  const site = match.siteInstructions;
  if (match.status !== "accepted" || !site) return null;
  return <div className="crew-site-instructions">
    <h4>{i18n.t("crew_live.site.title")}</h4>
    <dl>
      {site.propertyLabel ? <><dt>{i18n.t("crew_live.site.property")}</dt><dd>{site.propertyLabel}</dd></> : null}
      {site.gateCode ? <><dt>{i18n.t("crew_live.site.gate")}</dt><dd>{site.gateCode}</dd></> : null}
      {site.accessNotes ? <><dt>{i18n.t("crew_live.site.access")}</dt><dd>{site.accessNotes}</dd></> : null}
      <dt>{i18n.t("crew_live.site.notes")}</dt><dd>{site.customerNotes ?? i18n.t("crew_live.site.no_notes")}</dd>
      {site.lawnSizeSqFt ? <><dt>{i18n.t("crew_live.site.lawn")}</dt><dd>{i18n.t("crew_live.site.lawn_size", { size: site.lawnSizeSqFt })}</dd></> : null}
    </dl>
    <p>{i18n.t("crew_live.site.photos")}</p>
  </div>;
}
