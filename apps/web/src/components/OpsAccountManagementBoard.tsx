"use client";

import {
  CreateOpsAccountRequest,
  RequestPasswordResetResponse,
  OpsAccountSummary
} from "@yardmatch/contracts";
import { useEffect, useState } from "react";
import { createAuthenticatedWebApiClient } from "../lib/api";

function formatDateTime(iso?: string) {
  if (!iso) {
    return "Not set";
  }

  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function formatAccessChangeKind(kind: string) {
  return kind.replaceAll("-", " ");
}

function formatAuthenticationMethod(method?: string) {
  return method ? method.replaceAll("-", " ") : "Not set";
}

function formatFailedAuthenticationReason(reason?: string) {
  return reason ? reason.replaceAll("-", " ") : "Not set";
}

function formatAuthenticationEventKind(kind: string) {
  return kind.replaceAll("-", " ");
}

export function OpsAccountManagementBoard({ currentOpsUserId }: { currentOpsUserId?: string }) {
  const [accounts, setAccounts] = useState<OpsAccountSummary[]>([]);
  const [createDraft, setCreateDraft] = useState<CreateOpsAccountRequest>({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    internalScope: "operations",
    sendPasswordResetInvite: true
  });
  const [passwordResetPreview, setPasswordResetPreview] = useState<{
    accountName: string;
    details: RequestPasswordResetResponse;
  } | undefined>();
  const [profileDrafts, setProfileDrafts] = useState<
    Record<string, { fullName: string; phone: string; internalScope: "operations" | "admin" }>
  >({});
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});
  const [accessNoteDrafts, setAccessNoteDrafts] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isWorking, setIsWorking] = useState(false);

  async function loadAccounts() {
    const api = createAuthenticatedWebApiClient();
    const nextAccounts = await api.getOpsAccounts();
    setAccounts(nextAccounts);
  }

  useEffect(() => {
    void loadAccounts().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load ops accounts.");
    });
  }, []);

  function getProfileDraft(account: OpsAccountSummary) {
    return (
      profileDrafts[account.profile.id] ?? {
        fullName: account.profile.fullName,
        phone: account.profile.phone,
        internalScope: account.profile.internalScope
      }
    );
  }

  function getActorLabel(actorId?: string) {
    if (!actorId) {
      return "System";
    }

    const matchingAccount = accounts.find((account) => account.profile.id === actorId);
    return matchingAccount ? `${matchingAccount.profile.fullName} (${matchingAccount.profile.email})` : actorId;
  }

  async function createAccount() {
    try {
      setIsWorking(true);
      setStatusMessage(undefined);
      setErrorMessage(undefined);
      const api = createAuthenticatedWebApiClient();
      const created = await api.createOpsAccount({
        fullName: createDraft.fullName,
        email: createDraft.email,
        phone: createDraft.phone,
        password: createDraft.password?.trim() || undefined,
        internalScope: createDraft.internalScope,
        sendPasswordResetInvite: createDraft.sendPasswordResetInvite
      });
      setPasswordResetPreview(
        created.passwordReset
          ? {
              accountName: created.account.profile.fullName,
              details: created.passwordReset
            }
          : undefined
      );
      setCreateDraft({
        fullName: "",
        email: "",
        phone: "",
        password: "",
        internalScope: "operations",
        sendPasswordResetInvite: true
      });
      setStatusMessage(
        created.passwordReset
          ? "Ops account created and a password reset invite was prepared."
          : "Ops account created."
      );
      await loadAccounts();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create the ops account.");
    } finally {
      setIsWorking(false);
    }
  }

  async function saveProfile(account: OpsAccountSummary) {
    const draft = getProfileDraft(account);

    try {
      setIsWorking(true);
      setStatusMessage(undefined);
      setErrorMessage(undefined);
      const api = createAuthenticatedWebApiClient();
      await api.updateOpsAccount({
        opsUserId: account.profile.id,
        fullName: draft.fullName,
        phone: draft.phone,
        internalScope: draft.internalScope
      });
      setStatusMessage("Ops account details updated.");
      await loadAccounts();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update that ops account.");
    } finally {
      setIsWorking(false);
    }
  }

  async function rotateSessions(account: OpsAccountSummary, replacePassword: boolean) {
    try {
      setIsWorking(true);
      setStatusMessage(undefined);
      setErrorMessage(undefined);
      const api = createAuthenticatedWebApiClient();
      await api.rotateOpsAccountSessions({
        opsUserId: account.profile.id,
        newPassword: replacePassword ? passwordDrafts[account.profile.id]?.trim() || undefined : undefined
      });
      if (replacePassword) {
        setPasswordDrafts((current) => ({
          ...current,
          [account.profile.id]: ""
        }));
      }
      setStatusMessage(
        replacePassword
          ? "Ops password replaced and older sessions were revoked."
          : "Older sessions were revoked for that ops account."
      );
      await loadAccounts();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to rotate that ops account.");
    } finally {
      setIsWorking(false);
    }
  }

  async function requestPasswordReset(account: OpsAccountSummary) {
    try {
      setIsWorking(true);
      setStatusMessage(undefined);
      setErrorMessage(undefined);
      const api = createAuthenticatedWebApiClient();
      const result = await api.requestOpsAccountPasswordReset({
        opsUserId: account.profile.id
      });
      setPasswordResetPreview({
        accountName: result.account.profile.fullName,
        details: result.passwordReset
      });
      setStatusMessage("Password reset invite prepared for that ops account.");
      await loadAccounts();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to prepare a password reset invite.");
    } finally {
      setIsWorking(false);
    }
  }

  async function updateAccess(
    account: OpsAccountSummary,
    action: "deactivate" | "reactivate" | "clear-auth-lock"
  ) {
    try {
      setIsWorking(true);
      setStatusMessage(undefined);
      setErrorMessage(undefined);
      const api = createAuthenticatedWebApiClient();
      await api.updateOpsAccountAccess({
        opsUserId: account.profile.id,
        action,
        notes: accessNoteDrafts[account.profile.id]?.trim() || undefined
      });
      setStatusMessage(
        action === "deactivate"
          ? "Ops account deactivated and signed out everywhere."
          : action === "reactivate"
            ? "Ops account reactivated."
            : "Auth lock and failed-attempt state cleared for that ops account."
      );
      await loadAccounts();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to change that ops account access.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <section className="stack-lg">
      <div className="section-header">
        <h2>Ops account management</h2>
        <p>Manage internal staff logins from the authenticated ops dashboard instead of relying only on the seed account or CLI.</p>
      </div>
      {statusMessage ? <p>{statusMessage}</p> : null}
      {errorMessage ? <p>{errorMessage}</p> : null}
      {passwordResetPreview ? (
        <article className="card">
          <h3>Password reset preview</h3>
          <p>
            Prepared for {passwordResetPreview.accountName}. In production, this should flow through the normal email delivery path. In local development, the preview below keeps the staff-access workflow testable end to end.
          </p>
          <p>{passwordResetPreview.details.message}</p>
          {passwordResetPreview.details.expiresAtIso ? (
            <p>Expires {formatDateTime(passwordResetPreview.details.expiresAtIso)}</p>
          ) : null}
          {passwordResetPreview.details.resetCodePreview ? (
            <p>Reset code preview: {passwordResetPreview.details.resetCodePreview}</p>
          ) : null}
          {passwordResetPreview.details.resetUrlPreview ? (
            <p>Reset URL preview: {passwordResetPreview.details.resetUrlPreview}</p>
          ) : null}
        </article>
      ) : null}

      <article className="card">
        <h3>Create an ops account</h3>
        <p>Create a real internal staff login. The default internal office address is applied automatically for these non-customer accounts, and the preferred path is to prepare a reset invite instead of sharing a password manually.</p>
        <div className="form-grid">
          <label className="form-field">
            <span>Full name</span>
            <input
              className="input"
              disabled={isWorking}
              onChange={(event) => setCreateDraft((current) => ({ ...current, fullName: event.target.value }))}
              placeholder="Casey Ops"
              value={createDraft.fullName}
            />
          </label>
          <label className="form-field">
            <span>Email</span>
            <input
              className="input"
              disabled={isWorking}
              onChange={(event) => setCreateDraft((current) => ({ ...current, email: event.target.value }))}
              placeholder="ops@example.com"
              type="email"
              value={createDraft.email}
            />
          </label>
          <label className="form-field">
            <span>Phone</span>
            <input
              className="input"
              disabled={isWorking}
              onChange={(event) => setCreateDraft((current) => ({ ...current, phone: event.target.value }))}
              placeholder="555-0990"
              value={createDraft.phone}
            />
          </label>
          <label className="form-field">
            <span>Temporary password</span>
            <input
              className="input"
              disabled={isWorking}
              onChange={(event) => setCreateDraft((current) => ({ ...current, password: event.target.value }))}
              placeholder={createDraft.sendPasswordResetInvite ? "Optional when preparing a reset invite" : "StrongPass123!"}
              type="password"
              value={createDraft.password}
            />
          </label>
          <label className="form-field">
            <span>Provisioning mode</span>
            <select
              className="input"
              disabled={isWorking}
              onChange={(event) =>
                setCreateDraft((current) => ({
                  ...current,
                  sendPasswordResetInvite: event.target.value === "invite"
                }))
              }
              value={createDraft.sendPasswordResetInvite ? "invite" : "password"}
            >
              <option value="invite">Prepare password reset invite</option>
              <option value="password">Set password directly</option>
            </select>
          </label>
          <label className="form-field">
            <span>Ops scope</span>
            <select
              className="input"
              disabled={isWorking}
              onChange={(event) =>
                setCreateDraft((current) => ({
                  ...current,
                  internalScope: event.target.value === "admin" ? "admin" : "operations"
                }))
              }
              value={createDraft.internalScope ?? "operations"}
            >
              <option value="operations">Operations staff</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        </div>
        <div className="cta-row">
          <button className="button-secondary" disabled={isWorking} onClick={() => void createAccount()} type="button">
            {createDraft.sendPasswordResetInvite ? "Create account and prepare invite" : "Create ops login"}
          </button>
        </div>
      </article>

      <section className="card">
        <h3>Current ops accounts</h3>
        {accounts.length === 0 ? (
          <p>No ops accounts are available right now.</p>
        ) : (
          <div className="stack-lg" style={{ paddingBottom: 0 }}>
            {accounts.map((account) => {
              const draft = getProfileDraft(account);
              const isCurrentAccount = currentOpsUserId === account.profile.id;
              const passwordDraft = passwordDrafts[account.profile.id] ?? "";
              const accessNoteDraft = accessNoteDrafts[account.profile.id] ?? "";

              return (
                <article className="list-panel" key={account.profile.id}>
                  <div className="search-result-title">
                    <div>
                      <h3>{account.profile.fullName}</h3>
                      <p>
                        {account.profile.email}
                        {isCurrentAccount ? " • current session" : ""}
                      </p>
                    </div>
                    <span className="result-badge">{account.isActive ? "ops active" : "ops disabled"}</span>
                  </div>
                  <p>
                    Created {formatDateTime(account.profile.createdAt)} • Session version {account.sessionVersion} •{" "}
                    {account.hasPassword ? "Password set" : "No password set"}
                  </p>
                  <p>
                    Access state: {account.isActive ? "Active" : "Disabled"}
                    {account.accessDisabledAt ? ` • disabled ${formatDateTime(account.accessDisabledAt)}` : ""}
                    {account.accessDisabledBy ? ` by ${getActorLabel(account.accessDisabledBy)}` : ""}
                  </p>
                  {account.isAuthenticationLocked ? (
                    <p>Temporary login lock until {formatDateTime(account.authenticationLockExpiresAt)}</p>
                  ) : null}
                  <p>Ops scope: {account.profile.internalScope === "admin" ? "Admin" : "Operations staff"}</p>
                  <p>
                    Last sign-in: {formatDateTime(account.lastAuthenticatedAt)} • via{" "}
                    {formatAuthenticationMethod(account.lastAuthenticatedMethod)}
                  </p>
                  <p>
                    Failed sign-ins: {account.failedAuthenticationCount}
                    {account.lastFailedAuthenticationAt
                      ? ` • last ${formatFailedAuthenticationReason(account.lastFailedAuthenticationReason)} ${formatDateTime(account.lastFailedAuthenticationAt)}`
                      : ""}
                  </p>
                  {account.lastAccessChangeKind ? (
                    <p>
                      Last access change: {formatAccessChangeKind(account.lastAccessChangeKind)}
                      {account.lastAccessChangeAt ? ` • ${formatDateTime(account.lastAccessChangeAt)}` : ""}
                      {account.lastAccessChangeBy ? ` • by ${getActorLabel(account.lastAccessChangeBy)}` : ""}
                    </p>
                  ) : null}
                  {account.accessChangeNotes ? <p>Access note: {account.accessChangeNotes}</p> : null}
                  {account.passwordResetRequestedAt ? (
                    <p>
                      Password reset requested {formatDateTime(account.passwordResetRequestedAt)}
                      {account.passwordResetExpiresAt ? ` • expires ${formatDateTime(account.passwordResetExpiresAt)}` : ""}
                    </p>
                  ) : null}
                  <div className="stack-sm">
                    <h4>Authentication history</h4>
                    {account.authHistory.length === 0 ? (
                      <p>No authentication events have been recorded for this account yet.</p>
                    ) : (
                      <div className="stack-sm">
                        {account.authHistory
                          .slice()
                          .reverse()
                          .map((entry, index) => (
                            <article className="card" key={`${entry.occurredAt}-${entry.kind}-${index}`}>
                              <p>
                                {formatAuthenticationEventKind(entry.kind)} • {formatDateTime(entry.occurredAt)}
                              </p>
                              {entry.recordedBy ? <p>Recorded by {getActorLabel(entry.recordedBy)}</p> : null}
                              {entry.method ? <p>Method: {formatAuthenticationMethod(entry.method)}</p> : null}
                              {entry.reason ? (
                                <p>
                                  Failure reason: {formatFailedAuthenticationReason(entry.reason)}
                                  {entry.failedCount !== undefined
                                    ? ` • count ${entry.failedCount}`
                                    : ""}
                                </p>
                              ) : entry.failedCount !== undefined ? (
                                <p>Failed-attempt count: {entry.failedCount}</p>
                              ) : null}
                              {entry.lockExpiresAt ? (
                                <p>Lock expires {formatDateTime(entry.lockExpiresAt)}</p>
                              ) : null}
                              {entry.notes ? <p>Note: {entry.notes}</p> : null}
                            </article>
                          ))}
                      </div>
                    )}
                  </div>
                  <div className="stack-sm">
                    <h4>Access history</h4>
                    {account.accessHistory.length === 0 ? (
                      <p>No access changes have been recorded for this account yet.</p>
                    ) : (
                      <div className="stack-sm">
                        {account.accessHistory
                          .slice()
                          .reverse()
                          .map((entry, index) => (
                            <article className="card" key={`${entry.changedAt}-${entry.kind}-${index}`}>
                              <p>
                                {formatAccessChangeKind(entry.kind)} • {formatDateTime(entry.changedAt)}
                              </p>
                              <p>Changed by {getActorLabel(entry.changedBy)}</p>
                              {entry.notes ? <p>Note: {entry.notes}</p> : null}
                            </article>
                          ))}
                      </div>
                    )}
                  </div>
                  <div className="form-grid">
                    <label className="form-field">
                      <span>Full name</span>
                      <input
                        className="input"
                        disabled={isWorking}
                        onChange={(event) =>
                          setProfileDrafts((current) => ({
                            ...current,
                            [account.profile.id]: {
                              ...draft,
                              fullName: event.target.value
                            }
                          }))
                        }
                        value={draft.fullName}
                      />
                    </label>
                    <label className="form-field">
                      <span>Phone</span>
                      <input
                        className="input"
                        disabled={isWorking}
                        onChange={(event) =>
                          setProfileDrafts((current) => ({
                            ...current,
                            [account.profile.id]: {
                              ...draft,
                              phone: event.target.value
                            }
                          }))
                        }
                        value={draft.phone}
                      />
                    </label>
                    <label className="form-field">
                      <span>Ops scope</span>
                      <select
                        className="input"
                        disabled={isWorking || isCurrentAccount}
                        onChange={(event) =>
                          setProfileDrafts((current) => ({
                            ...current,
                            [account.profile.id]: {
                              ...draft,
                              internalScope: event.target.value === "admin" ? "admin" : "operations"
                            }
                          }))
                        }
                        value={draft.internalScope}
                      >
                        <option value="operations">Operations staff</option>
                        <option value="admin">Admin</option>
                      </select>
                    </label>
                    <label className="form-field">
                      <span>Replacement password</span>
                      <input
                        className="input"
                        disabled={isWorking || isCurrentAccount}
                        onChange={(event) =>
                          setPasswordDrafts((current) => ({
                            ...current,
                            [account.profile.id]: event.target.value
                          }))
                        }
                        placeholder={isCurrentAccount ? "Manage your own password from account settings later" : "Optional strong replacement password"}
                        type="password"
                        value={passwordDraft}
                      />
                    </label>
                    <label className="form-field">
                      <span>Access change note</span>
                      <textarea
                        className="input"
                        disabled={isWorking || isCurrentAccount}
                        onChange={(event) =>
                          setAccessNoteDrafts((current) => ({
                            ...current,
                            [account.profile.id]: event.target.value
                          }))
                        }
                        placeholder={
                          account.isAuthenticationLocked || account.failedAuthenticationCount > 0
                            ? "Required when clearing a lock or failed-attempt state."
                            : account.isActive
                              ? "Why is this account being disabled?"
                              : "Why is this account being reactivated?"
                        }
                        rows={3}
                        value={accessNoteDraft}
                      />
                    </label>
                  </div>
                  <div className="cta-row">
                    <button
                      className="button-secondary"
                      disabled={isWorking || !account.isActive}
                      onClick={() => void requestPasswordReset(account)}
                      type="button"
                    >
                      Prepare reset link
                    </button>
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() => void saveProfile(account)}
                      type="button"
                    >
                      Save details
                    </button>
                    <button
                      className="button-secondary"
                      disabled={isWorking || isCurrentAccount}
                      onClick={() => void rotateSessions(account, false)}
                      type="button"
                    >
                      Force sign-out everywhere
                    </button>
                    <button
                      className="button-secondary"
                      disabled={isWorking || isCurrentAccount || passwordDraft.trim().length === 0}
                      onClick={() => void rotateSessions(account, true)}
                      type="button"
                    >
                      Replace password and revoke sessions
                    </button>
                    <button
                      className="button-secondary"
                      disabled={isWorking || isCurrentAccount || !account.isActive}
                      onClick={() => void updateAccess(account, "deactivate")}
                      type="button"
                    >
                      Deactivate account
                    </button>
                    <button
                      className="button-secondary"
                      disabled={isWorking || isCurrentAccount || account.isActive}
                      onClick={() => void updateAccess(account, "reactivate")}
                      type="button"
                    >
                      Reactivate account
                    </button>
                    <button
                      className="button-secondary"
                      disabled={
                        isWorking ||
                        isCurrentAccount ||
                        (!account.isAuthenticationLocked && account.failedAuthenticationCount === 0)
                      }
                      onClick={() => void updateAccess(account, "clear-auth-lock")}
                      type="button"
                    >
                      Clear auth lock
                    </button>
                  </div>
                  {isCurrentAccount ? (
                    <p>For safety, the dashboard does not let you revoke or deactivate your own active ops session from this board.</p>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
