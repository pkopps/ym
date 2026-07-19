"use client";

import { localizeLaunchOpsPlaybookSections } from "../lib/launchOpsPlaybookContent";
import { useI18n } from "@yardmatch/i18n/react";

export function OpsLaunchPlaybook() {
  const i18n = useI18n();
  const launchOpsPlaybookSections = localizeLaunchOpsPlaybookSections(i18n);

  return (
    <section className="card">
      <span className="eyebrow">{i18n.t("ops_auto.ops_launch_playbook.launch_playbook_pv92ve")}</span>
      <h2>{i18n.t("ops_auto.ops_launch_playbook.run_the_first_weeks_with_explicit_rules_td5476")}</h2>
      <p>
        {i18n.t("ops_auto.ops_launch_playbook.this_turns_the_launch_checklist_into_working_guidance_5do9jy")} </p>

      <div className="stack-lg" style={{ paddingBottom: 0 }}>
        {launchOpsPlaybookSections.map((section) => (
          <article className="list-panel" key={section.id}>
            <span className="eyebrow">{section.eyebrow}</span>
            <h3>{section.title}</h3>
            <p>{section.summary}</p>

            <div className="stack-md" style={{ paddingBottom: 0 }}>
              {section.scenarios.map((scenario) => (
                <article className="card" key={scenario.id}>
                  <h4>{scenario.title}</h4>
                  <p>
                    <strong>{i18n.t("ops_auto.ops_launch_playbook.trigger_pxe1sy")}</strong> {scenario.trigger}
                  </p>
                  <p>
                    <strong>{i18n.t("ops_auto.ops_launch_playbook.primary_action_h45pbu")}</strong> {scenario.primaryAction}
                  </p>
                  <p>
                    <strong>{i18n.t("ops_auto.ops_launch_playbook.customer_owner_5rp3rd")}</strong> {scenario.customerOwner}
                  </p>
                  <p>
                    <strong>{i18n.t("ops_auto.ops_launch_playbook.escalate_when_bwc1la")}</strong> {scenario.escalationRule}
                  </p>
                  <div className="stack-sm">
                    <p>{i18n.t("ops_auto.ops_launch_playbook.guardrails_8rihfg")}</p>
                    <ul className="timeline">
                      {scenario.guardrails.map((guardrail) => (
                        <li key={guardrail}>
                          <strong>!</strong>
                          <span>{guardrail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
