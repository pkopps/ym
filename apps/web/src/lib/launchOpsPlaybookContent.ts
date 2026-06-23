import { launchAreaLabel } from "./site";

export interface LaunchOpsPlaybookScenario {
  id: string;
  title: string;
  trigger: string;
  primaryAction: string;
  customerOwner: string;
  escalationRule: string;
  guardrails: string[];
}

export interface LaunchOpsPlaybookSection {
  id: string;
  eyebrow: string;
  title: string;
  summary: string;
  scenarios: LaunchOpsPlaybookScenario[];
}

export const launchOpsPlaybookSections: LaunchOpsPlaybookSection[] = [
  {
    id: "coverage",
    eyebrow: "Coverage",
    title: "Launch radius and manual review",
    summary:
      `Keep ${launchAreaLabel} dense and manageable. Do not promise out-of-area work just because a provider says they might stretch for it.`,
    scenarios: [
      {
        id: "out-of-area",
        title: "Inquiry is outside the current launch pocket",
        trigger: `The property sits outside the currently approved ${launchAreaLabel} launch area or needs a route stretch that ops has not approved.`,
        primaryAction:
          "Keep the lead open only long enough to confirm the address, then close it as out-of-area or move it into manual review before quoting timing.",
        customerOwner: "Ops owns the first response.",
        escalationRule:
          "Escalate only if the address is strategically adjacent to existing completed-work pockets or a verified provider already serves that exact block.",
        guardrails: [
          "Do not promise availability outside the approved radius.",
          "Do not convert a maybe into a booking just to test coverage.",
          "If supply is thin, preserve route density over one-off expansion."
        ]
      },
      {
        id: "low-supply",
        title: "No provider can take the job cleanly",
        trigger:
          "Searches show no verified provider match, or the available providers have no credible route window without forcing a bad operational fit.",
        primaryAction:
          "Use provider outreach first, then either offer a realistic later window or close the loop instead of letting the request age in limbo.",
        customerOwner: "Ops sends the timing reset or closeout.",
        escalationRule:
          "Escalate when multiple open leads in the same service pocket are stalling so launch pricing, radius, or provider recruiting can be adjusted intentionally.",
        guardrails: [
          "Do not overbook a provider just to save a lead.",
          "Avoid same-day promises when the route is already fragile.",
          "Document whether the miss was coverage, timing, payout fit, or service mismatch."
        ]
      }
    ]
  },
  {
    id: "service-disruption",
    eyebrow: "Service disruption",
    title: "Weather, delays, and reschedules",
    summary:
      "When service risk is operational, communication should get clearer and earlier, not more improvisational.",
    scenarios: [
      {
        id: "weather",
        title: "Weather makes the planned route unrealistic",
        trigger:
          "Heavy rain, unsafe conditions, or ground conditions make the scheduled job poor quality or operationally risky.",
        primaryAction:
          "Reschedule before the crew is trapped in an impossible route. Use the support or booking reschedule flow and give the customer the next realistic window.",
        customerOwner: "Ops or the provider lead owns the outbound update, but ops should confirm the fallback plan.",
        escalationRule:
          "Escalate when weather is affecting multiple jobs in the same day so the route plan is reset once instead of one ticket at a time.",
        guardrails: [
          "Do not push crews into low-quality service just to preserve the original slot.",
          "Prefer an explicit later window over vague same-day language.",
          "If the weather decision changes payout, note that before the visit is marked complete."
        ]
      },
      {
        id: "delay",
        title: "Crew is late or blocked in the field",
        trigger:
          "The provider sends a late update, access is blocked, or the customer is not ready when the crew arrives.",
        primaryAction:
          "Use the delay or issue update immediately, then decide whether the visit should continue, reschedule, or move into support before the route stalls further.",
        customerOwner: "Provider lead sends the first field update; ops owns the final expectation reset if the issue persists.",
        escalationRule:
          "Escalate when the same booking gets more than one operational reversal or when the field issue could become a refund or dispute risk.",
        guardrails: [
          "Keep the next action explicit: continue, reschedule, or close out.",
          "Do not leave the customer waiting on an unresolved 'we are checking' loop.",
          "Capture the field note before support resolution starts."
        ]
      }
    ]
  },
  {
    id: "attendance",
    eyebrow: "Attendance",
    title: "No-shows and failed handoffs",
    summary:
      "The first weeks of launch need sharper rules around who missed the handoff and how quickly the team closes the loop.",
    scenarios: [
      {
        id: "customer-no-show",
        title: "Customer no-show or property not ready",
        trigger:
          "The crew cannot start because the customer is absent, access is not ready, or the property conditions prevent the agreed scope.",
        primaryAction:
          "Log the booking exception immediately, notify the customer, and decide whether the visit should be rescheduled or routed into support for a final decision.",
        customerOwner: "Provider lead initiates the field note; ops owns any follow-up that changes the booking outcome.",
        escalationRule:
          "Escalate when the no-show could trigger a fee dispute, a service-quality complaint, or a same-day crew hole that affects later jobs.",
        guardrails: [
          "Do not mark the booking complete just because the crew arrived.",
          "Do not reopen the route without a confirmed new window.",
          "If the customer contests the story, move it into support with evidence attached."
        ]
      },
      {
        id: "provider-no-show",
        title: "Provider accepts then cannot fulfill",
        trigger:
          "A provider confirms the job but later drops it, no-shows, or cannot cover the route without breaking service expectations.",
        primaryAction:
          "Try curated fallback supply first. If no clean replacement exists, reset the customer expectation quickly instead of pretending coverage is still intact.",
        customerOwner: "Ops owns the final customer explanation and recovery plan.",
        escalationRule:
          "Escalate immediately when the provider failure exposes a repeat reliability problem or leaves a high-value recurring customer stranded.",
        guardrails: [
          "Protect trust before short-term conversion numbers.",
          "Record whether the failure was staffing, route pressure, or provider reliability.",
          "If there is no safe fallback, say so early."
        ]
      }
    ]
  },
  {
    id: "verification",
    eyebrow: "Verification",
    title: "Provider go-live standards",
    summary:
      "Verification should screen for launch readiness, not just profile completeness.",
    scenarios: [
      {
        id: "approve-provider",
        title: "Provider is ready to go live",
        trigger:
          "The business profile is coherent, the service categories match the launch plan, and the provider can credibly serve the launch area without stretching the route.",
        primaryAction:
          "Approve only when ops is comfortable letting the provider appear in recommendation-first customer search today.",
        customerOwner: "No customer communication needed yet; this is a supply-quality gate.",
        escalationRule:
          "Escalate if the provider is strategically valuable but still unclear on service area, payout expectations, or reliability standards.",
        guardrails: [
          "Verification is a launch-quality gate, not a courtesy approval.",
          "Prefer fewer reliable providers over broad fragile supply.",
          "If ops sends the provider back, the note should say exactly what needs to change."
        ]
      }
    ]
  }
];
