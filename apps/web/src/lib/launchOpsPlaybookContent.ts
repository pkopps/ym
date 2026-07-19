import type { I18nInstance, TranslationKey } from "@yardmatch/i18n";

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

interface LaunchOpsPlaybookScenarioDefinition {
  id: string;
  keyPrefix: string;
  guardrailCount: number;
}

interface LaunchOpsPlaybookSectionDefinition {
  id: string;
  keyPrefix: string;
  scenarios: LaunchOpsPlaybookScenarioDefinition[];
}

const launchOpsPlaybookSectionDefinitions: LaunchOpsPlaybookSectionDefinition[] = [
  {
    id: "coverage",
    keyPrefix: "ops_launch_playbook.coverage",
    scenarios: [
      { id: "out-of-area", keyPrefix: "ops_launch_playbook.coverage.out_of_area", guardrailCount: 3 },
      { id: "low-supply", keyPrefix: "ops_launch_playbook.coverage.low_supply", guardrailCount: 3 }
    ]
  },
  {
    id: "service-disruption",
    keyPrefix: "ops_launch_playbook.service_disruption",
    scenarios: [
      { id: "weather", keyPrefix: "ops_launch_playbook.service_disruption.weather", guardrailCount: 3 },
      { id: "delay", keyPrefix: "ops_launch_playbook.service_disruption.delay", guardrailCount: 3 }
    ]
  },
  {
    id: "attendance",
    keyPrefix: "ops_launch_playbook.attendance",
    scenarios: [
      { id: "customer-no-show", keyPrefix: "ops_launch_playbook.attendance.customer_no_show", guardrailCount: 3 },
      { id: "provider-no-show", keyPrefix: "ops_launch_playbook.attendance.provider_no_show", guardrailCount: 3 }
    ]
  },
  {
    id: "verification",
    keyPrefix: "ops_launch_playbook.verification",
    scenarios: [
      { id: "approve-provider", keyPrefix: "ops_launch_playbook.verification.approve_provider", guardrailCount: 3 }
    ]
  }
];

function key(value: string): TranslationKey {
  return value as TranslationKey;
}

export function localizeLaunchOpsPlaybookSections(i18n: I18nInstance): LaunchOpsPlaybookSection[] {
  const launchArea = i18n.t("common.area.launch");

  return launchOpsPlaybookSectionDefinitions.map((section) => ({
    id: section.id,
    eyebrow: i18n.t(key(`${section.keyPrefix}.eyebrow`), { launchArea }),
    title: i18n.t(key(`${section.keyPrefix}.title`), { launchArea }),
    summary: i18n.t(key(`${section.keyPrefix}.summary`), { launchArea }),
    scenarios: section.scenarios.map((scenario) => ({
      id: scenario.id,
      title: i18n.t(key(`${scenario.keyPrefix}.title`), { launchArea }),
      trigger: i18n.t(key(`${scenario.keyPrefix}.trigger`), { launchArea }),
      primaryAction: i18n.t(key(`${scenario.keyPrefix}.primary_action`), { launchArea }),
      customerOwner: i18n.t(key(`${scenario.keyPrefix}.customer_owner`), { launchArea }),
      escalationRule: i18n.t(key(`${scenario.keyPrefix}.escalation_rule`), { launchArea }),
      guardrails: Array.from({ length: scenario.guardrailCount }, (_, index) =>
        i18n.t(key(`${scenario.keyPrefix}.guardrail.${index + 1}`), { launchArea })
      )
    }))
  }));
}
