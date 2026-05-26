"use client";

import { useMemo, useState } from "react";
import { providerCrewPayouts } from "@yardmatch/ui";

type PayoutAccount = {
  id: string;
  accountHolder: string;
  bankName: string;
  last4: string;
  routingLabel: string;
  isDefault: boolean;
};

const initialPayoutAccounts: PayoutAccount[] = [
  {
    id: "bank-1",
    accountHolder: "GreenStride Lawn Co.",
    bankName: "First Horizon Business Checking",
    last4: "4418",
    routingLabel: "Direct deposit account",
    isDefault: true
  },
  {
    id: "bank-2",
    accountHolder: "GreenStride Lawn Co.",
    bankName: "Pinnacle Operating Account",
    last4: "9021",
    routingLabel: "Overflow payout account",
    isDefault: false
  }
];

export function ProviderPaymentsBoard() {
  const [payoutAccounts, setPayoutAccounts] = useState(initialPayoutAccounts);
  const [showAddAccount, setShowAddAccount] = useState(false);

  const readyPayouts = providerCrewPayouts.filter((payout) => payout.status === "ready");
  const scheduledPayouts = providerCrewPayouts.filter((payout) => payout.status === "scheduled");
  const paidPayouts = providerCrewPayouts.filter((payout) => payout.status === "paid");

  const availableEarnings = readyPayouts.reduce(
    (total, payout) => total + Number(payout.amountLabel.replace(/[^0-9.]/g, "")),
    0
  );

  const defaultPayoutAccount = payoutAccounts.find((account) => account.isDefault) ?? payoutAccounts[0];
  const instantCashoutsRemaining = 4;
  const instantCashoutFee = "$0.85";
  const weeklyDepositDay = "Thursday";

  const payoutRows = useMemo(
    () =>
      providerCrewPayouts.map((payout) => ({
        ...payout,
        statusLabel:
          payout.status === "ready"
            ? "Available for instant cash-out"
            : payout.status === "scheduled"
              ? "Scheduled for weekly deposit"
              : "Paid out"
      })),
    []
  );

  function setDefaultPayoutAccount(accountId: string) {
    setPayoutAccounts((currentAccounts) =>
      currentAccounts.map((account) => ({
        ...account,
        isDefault: account.id === accountId
      }))
    );
  }

  return (
    <div className="stack-lg">
      <section className="grid-three">
        <article className="card">
          <h2>${availableEarnings}</h2>
          <p>Available earnings</p>
        </article>
        <article className="card">
          <h2>{weeklyDepositDay}</h2>
          <p>Weekly deposit day</p>
        </article>
        <article className="card">
          <h2>{instantCashoutsRemaining}</h2>
          <p>Instant cash-outs left today</p>
        </article>
        <article className="card">
          <h2>{instantCashoutFee}</h2>
          <p>Instant cash-out fee</p>
        </article>
        <article className="card">
          <h2>{payoutAccounts.length}</h2>
          <p>Bank accounts on file</p>
        </article>
        <article className="card">
          <h2>{scheduledPayouts.length + readyPayouts.length}</h2>
          <p>Pending payout items</p>
        </article>
      </section>

      <section className="provider-capacity-alert provider-capacity-alert--healthy">
        <div>
          <span className="eyebrow">Payout flow</span>
          <h2>Weekly direct deposit is the default. Instant cash-out is available any time for a small fee.</h2>
          <p>
            Earnings sit in your payout wallet after completed service. You can let them land automatically in your
            default bank account each week, or trigger an instant cash-out up to 6 times a day.
          </p>
        </div>
        <div className="cta-row">
          <button className="button" type="button">
            Cash out now
          </button>
          <button
            className="button-secondary"
            onClick={() => setShowAddAccount((isOpen) => !isOpen)}
            type="button"
          >
            {showAddAccount ? "Close bank form" : "Add bank account"}
          </button>
        </div>
      </section>

      <section className="grid-two">
        <article className="card provider-payment-card-stack">
          <div className="search-result-title">
            <div>
              <span className="eyebrow">Weekly deposits</span>
              <h2>Payout settings</h2>
            </div>
          </div>

          <div className="provider-payout-settings">
            <div>
              <strong>Default payout cadence</strong>
              <p>Automatic weekly direct deposit</p>
            </div>
            <div>
              <strong>Deposit timing</strong>
              <p>Funds typically land by {weeklyDepositDay} or Friday</p>
            </div>
            <div>
              <strong>Instant payout</strong>
              <p>Manual cash-out available any time, up to 6 times per day</p>
            </div>
          </div>

          {payoutAccounts.map((account) => (
            <div className="provider-card-method" key={account.id}>
              <div>
                <strong>
                  {account.bankName} •••• {account.last4}
                </strong>
                <p>{account.accountHolder}</p>
                <p>{account.routingLabel}</p>
              </div>
              <div className="provider-card-method__actions">
                {account.isDefault ? (
                  <span className="provider-staffing-badge provider-staffing-badge--healthy">Default</span>
                ) : (
                  <button className="button-secondary" onClick={() => setDefaultPayoutAccount(account.id)} type="button">
                    Set default
                  </button>
                )}
              </div>
            </div>
          ))}

          {showAddAccount ? (
            <div className="provider-add-card-form">
              <div className="form-grid">
                <label className="form-field">
                  <span>Account holder</span>
                  <input placeholder="GreenStride Lawn Co." />
                </label>
                <label className="form-field">
                  <span>Bank name</span>
                  <input placeholder="First Horizon Business Checking" />
                </label>
                <label className="form-field form-field--full">
                  <span>Routing number</span>
                  <input placeholder="021000021" />
                </label>
                <label className="form-field form-field--full">
                  <span>Account number</span>
                  <input placeholder="••••••••4418" />
                </label>
              </div>
              <div className="cta-row">
                <button className="button" type="button">
                  Save bank account
                </button>
                <button className="button-secondary" onClick={() => setShowAddAccount(false)} type="button">
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </article>

        <article className="card provider-payment-card-stack">
          <div className="search-result-title">
            <div>
              <span className="eyebrow">Wallet</span>
              <h2>Crew payout queue</h2>
            </div>
          </div>

          {payoutRows.map((payout) => (
            <div className="provider-payout-row" key={payout.id}>
              <div>
                <strong>{payout.crewMemberName}</strong>
                <p>{payout.jobLabel}</p>
                <p>
                  {payout.serviceDateLabel} • {payout.addressLine}
                </p>
              </div>
              <div className="provider-payout-row__meta">
                <strong>{payout.amountLabel}</strong>
                <span
                  className={`provider-staffing-badge ${
                    payout.status === "paid"
                      ? "provider-staffing-badge--healthy"
                      : payout.status === "scheduled"
                        ? ""
                        : "provider-staffing-badge--warning"
                  }`}
                >
                  {payout.statusLabel}
                </span>
              </div>
            </div>
          ))}

          <div className="provider-wallet-note">
            <strong>Wallet action</strong>
            <p>Select available earnings and use Cash out now when you want funds before the weekly direct deposit.</p>
          </div>
        </article>
      </section>
    </div>
  );
}
