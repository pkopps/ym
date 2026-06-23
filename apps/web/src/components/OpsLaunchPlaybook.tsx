"use client";

import { launchOpsPlaybookSections } from "../lib/launchOpsPlaybookContent";

export function OpsLaunchPlaybook() {
  return (
    <section className="card">
      <span className="eyebrow">Launch playbook</span>
      <h2>Run the first weeks with explicit rules.</h2>
      <p>
        This turns the launch checklist into working guidance for coverage, service recovery,
        no-shows, and provider go-live decisions.
      </p>

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
                    <strong>Trigger:</strong> {scenario.trigger}
                  </p>
                  <p>
                    <strong>Primary action:</strong> {scenario.primaryAction}
                  </p>
                  <p>
                    <strong>Customer owner:</strong> {scenario.customerOwner}
                  </p>
                  <p>
                    <strong>Escalate when:</strong> {scenario.escalationRule}
                  </p>
                  <div className="stack-sm">
                    <p>Guardrails</p>
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
