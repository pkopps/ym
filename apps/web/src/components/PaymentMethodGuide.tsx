"use client";

import { useI18n } from "@yardmatch/i18n/react";
import styles from "./PaymentMethodGuide.module.css";

export function PaymentMethodGuide({ returningCustomer = false }: { returningCustomer?: boolean }) {
  const i18n = useI18n();
  return (
    <div className={styles.guide} data-testid="payment-method-guide">
      <strong>{i18n.t("payments.choice.title")}</strong>
      <p>{i18n.t("payments.choice.body")}</p>
      <details>
        <summary data-analytics-action="view-bank-payment">
          {i18n.t(returningCustomer ? "payments.bank.returning" : "payments.bank.option")}
        </summary>
        <p>{i18n.t("payments.bank.body")}</p>
        <p>{i18n.t("payments.bank.timing")}</p>
      </details>
    </div>
  );
}
