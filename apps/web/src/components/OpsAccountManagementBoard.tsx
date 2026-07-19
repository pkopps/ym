"use client";

import {
  CreateOpsAccountRequest,
  RequestPasswordResetResponse,
  OpsAccountSummary
} from "@yardmatch/contracts";
import { useEffect, useState } from "react";
import { createAuthenticatedWebApiClient } from "../lib/api";
import { useI18n } from "@yardmatch/i18n/react";

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
  const i18n = useI18n();
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
        <h2>{i18n.t("ops_auto.ops_account_management_board.ops_account_management_3dg678")}</h2>
        <p>{i18n.t("ops_auto.ops_account_management_board.manage_internal_staff_logins_from_the_authenticated_ops_79h89g")}</p>
      </div>
      {statusMessage ? <p>{statusMessage}</p> : null}
      {errorMessage ? <p>{errorMessage}</p> : null}
      {passwordResetPreview ? (
        <article className="card">
          <h3>{i18n.t("ops_auto.ops_account_management_board.password_reset_preview_i7jxq")}</h3>
          <p>
            {i18n.t("ops_auto.ops_account_management_board.prepared_for_useuey")} {passwordResetPreview.accountName}. In production, this should flow through the normal email delivery path. In local development, the preview below keeps the staff-access workflow testable end to end.
          </p>
          <p>{passwordResetPreview.details.message}</p>
          {passwordResetPreview.details.expiresAtIso ? (
            <p>{i18n.t("ops_auto.ops_account_management_board.expires_5vlu6s")} {formatDateTime(passwordResetPreview.details.expiresAtIso)}</p>
          ) : null}
          {passwordResetPreview.details.resetCodePreview ? (
            <p>{i18n.t("ops_auto.ops_account_management_board.reset_code_preview_2u6fos")} {passwordResetPreview.details.resetCodePreview}</p>
          ) : null}
          {passwordResetPreview.details.resetUrlPreview ? (
            <p>{i18n.t("ops_auto.ops_account_management_board.reset_url_preview_irdci4")} {passwordResetPreview.details.resetUrlPreview}</p>
          ) : null}
        </article>
      ) : null}

      <article className="card">
        <h3>{i18n.t("ops_auto.ops_account_management_board.create_an_ops_account_qlyypc")}</h3>
        <p>{i18n.t("ops_auto.ops_account_management_board.create_a_real_internal_staff_login_the_default_syz517")}</p>
        <div className="form-grid">
          <label className="form-field">
            <span>{i18n.t("ops_auto.ops_account_management_board.full_name_4fx8po")}</span>
            <input
              className="input"
              disabled={isWorking}
              onChange={(event) => setCreateDraft((current) => ({ ...current, fullName: event.target.value }))}
              placeholder={i18n.t("ops_auto.ops_account_management_board.casey_ops_qfnqw5")}
              value={createDraft.fullName}
            />
          </label>
          <label className="form-field">
            <span>{i18n.t("ops_auto.ops_account_management_board.email_13xh18")}</span>
            <input
              className="input"
              disabled={isWorking}
              onChange={(event) => setCreateDraft((current) => ({ ...current, email: event.target.value }))}
              placeholder={i18n.t("ops_auto.ops_account_management_board.ops_example_com_rwjfqn")}
              type="email"
              value={createDraft.email}
            />
          </label>
          <label className="form-field">
            <span>{i18n.t("ops_auto.ops_account_management_board.phone_19wb4e")}</span>
            <input
              className="input"
              disabled={isWorking}
              onChange={(event) => setCreateDraft((current) => ({ ...current, phone: event.target.value }))}
              placeholder="555-0990"
              value={createDraft.phone}
            />
          </label>
          <label className="form-field">
            <span>{i18n.t("ops_auto.ops_account_management_board.temporary_password_n5n6wa")}</span>
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
            <span>{i18n.t("ops_auto.ops_account_management_board.provisioning_mode_ib5ulm")}</span>
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
              <option value="invite">{i18n.t("ops_auto.ops_account_management_board.prepare_password_reset_invite_7jw7om")}</option>
              <option value="password">{i18n.t("ops_auto.ops_account_management_board.set_password_directly_osgszh")}</option>
            </select>
          </label>
          <label className="form-field">
            <span>{i18n.t("ops_auto.ops_account_management_board.ops_scope_eh5ume")}</span>
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
              <option value="operations">{i18n.t("ops_auto.ops_account_management_board.operations_staff_hs329g")}</option>
              <option value="admin">{i18n.t("ops_auto.ops_account_management_board.admin_11ksof")}</option>
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
        <h3>{i18n.t("ops_auto.ops_account_management_board.current_ops_accounts_6bk1rv")}</h3>
        {accounts.length === 0 ? (
          <p>{i18n.t("ops_auto.ops_account_management_board.no_ops_accounts_are_available_right_now_sydo6k")}</p>
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
                    {i18n.t("ops_auto.ops_account_management_board.created_qhn9ko")} {formatDateTime(account.profile.createdAt)} {i18n.t("ops_auto.ops_account_management_board.session_version_hh9ya8")} {account.sessionVersion} •{" "}
                    {account.hasPassword ? "Password set" : "No password set"}
                  </p>
                  <p>
                    {i18n.t("ops_auto.ops_account_management_board.access_state_bw4t0l")} {account.isActive ? "Active" : "Disabled"}
                    {account.accessDisabledAt ? ` • disabled ${formatDateTime(account.accessDisabledAt)}` : ""}
                    {account.accessDisabledBy ? ` by ${getActorLabel(account.accessDisabledBy)}` : ""}
                  </p>
                  {account.isAuthenticationLocked ? (
                    <p>{i18n.t("ops_auto.ops_account_management_board.temporary_login_lock_until_tepjyn")} {formatDateTime(account.authenticationLockExpiresAt)}</p>
                  ) : null}
                  <p>{i18n.t("ops_auto.ops_account_management_board.ops_scope_mld1h0")} {account.profile.internalScope === "admin" ? "Admin" : "Operations staff"}</p>
                  <p>
                    {i18n.t("ops_auto.ops_account_management_board.last_sign_in_6l319t")} {formatDateTime(account.lastAuthenticatedAt)} {i18n.t("ops_auto.ops_account_management_board.via_gell9s")}{" "}
                    {formatAuthenticationMethod(account.lastAuthenticatedMethod)}
                  </p>
                  <p>
                    {i18n.t("ops_auto.ops_account_management_board.failed_sign_ins_2s3y7b")} {account.failedAuthenticationCount}
                    {account.lastFailedAuthenticationAt
                      ? ` • last ${formatFailedAuthenticationReason(account.lastFailedAuthenticationReason)} ${formatDateTime(account.lastFailedAuthenticationAt)}`
                      : ""}
                  </p>
                  {account.lastAccessChangeKind ? (
                    <p>
                      {i18n.t("ops_auto.ops_account_management_board.last_access_change_i3qj5k")} {formatAccessChangeKind(account.lastAccessChangeKind)}
                      {account.lastAccessChangeAt ? ` • ${formatDateTime(account.lastAccessChangeAt)}` : ""}
                      {account.lastAccessChangeBy ? ` • by ${getActorLabel(account.lastAccessChangeBy)}` : ""}
                    </p>
                  ) : null}
                  {account.accessChangeNotes ? <p>{i18n.t("ops_auto.ops_account_management_board.access_note_brf5kc")} {account.accessChangeNotes}</p> : null}
                  {account.passwordResetRequestedAt ? (
                    <p>
                      {i18n.t("ops_auto.ops_account_management_board.password_reset_requested_yo3atk")} {formatDateTime(account.passwordResetRequestedAt)}
                      {account.passwordResetExpiresAt ? ` • expires ${formatDateTime(account.passwordResetExpiresAt)}` : ""}
                    </p>
                  ) : null}
                  <div className="stack-sm">
                    <h4>{i18n.t("ops_auto.ops_account_management_board.authentication_history_dhdw50")}</h4>
                    {account.authHistory.length === 0 ? (
                      <p>{i18n.t("ops_auto.ops_account_management_board.no_authentication_events_have_been_recorded_for_this_hfblle")}</p>
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
                              {entry.recordedBy ? <p>{i18n.t("ops_auto.ops_account_management_board.recorded_by_lkrbdl")} {getActorLabel(entry.recordedBy)}</p> : null}
                              {entry.method ? <p>{i18n.t("ops_auto.ops_account_management_board.method_rp4cdj")} {formatAuthenticationMethod(entry.method)}</p> : null}
                              {entry.reason ? (
                                <p>
                                  {i18n.t("ops_auto.ops_account_management_board.failure_reason_eu8k74")} {formatFailedAuthenticationReason(entry.reason)}
                                  {entry.failedCount !== undefined
                                    ? ` • count ${entry.failedCount}`
                                    : ""}
                                </p>
                              ) : entry.failedCount !== undefined ? (
                                <p>{i18n.t("ops_auto.ops_account_management_board.failed_attempt_count_pohwz2")} {entry.failedCount}</p>
                              ) : null}
                              {entry.lockExpiresAt ? (
                                <p>{i18n.t("ops_auto.ops_account_management_board.lock_expires_2hqpwh")} {formatDateTime(entry.lockExpiresAt)}</p>
                              ) : null}
                              {entry.notes ? <p>{i18n.t("ops_auto.ops_account_management_board.note_18xaaw")} {entry.notes}</p> : null}
                            </article>
                          ))}
                      </div>
                    )}
                  </div>
                  <div className="stack-sm">
                    <h4>{i18n.t("ops_auto.ops_account_management_board.access_history_at5loo")}</h4>
                    {account.accessHistory.length === 0 ? (
                      <p>{i18n.t("ops_auto.ops_account_management_board.no_access_changes_have_been_recorded_for_this_osu2uu")}</p>
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
                              <p>{i18n.t("ops_auto.ops_account_management_board.changed_by_2a6tul")} {getActorLabel(entry.changedBy)}</p>
                              {entry.notes ? <p>{i18n.t("ops_auto.ops_account_management_board.note_18xaaw")} {entry.notes}</p> : null}
                            </article>
                          ))}
                      </div>
                    )}
                  </div>
                  <div className="form-grid">
                    <label className="form-field">
                      <span>{i18n.t("ops_auto.ops_account_management_board.full_name_4fx8po")}</span>
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
                      <span>{i18n.t("ops_auto.ops_account_management_board.phone_19wb4e")}</span>
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
                      <span>{i18n.t("ops_auto.ops_account_management_board.ops_scope_eh5ume")}</span>
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
                        <option value="operations">{i18n.t("ops_auto.ops_account_management_board.operations_staff_hs329g")}</option>
                        <option value="admin">{i18n.t("ops_auto.ops_account_management_board.admin_11ksof")}</option>
                      </select>
                    </label>
                    <label className="form-field">
                      <span>{i18n.t("ops_auto.ops_account_management_board.replacement_password_g6hxpz")}</span>
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
                      <span>{i18n.t("ops_auto.ops_account_management_board.access_change_note_2yrupm")}</span>
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
                      {i18n.t("ops_auto.ops_account_management_board.prepare_reset_link_lstjb0")} </button>
                    <button
                      className="button-secondary"
                      disabled={isWorking}
                      onClick={() => void saveProfile(account)}
                      type="button"
                    >
                      {i18n.t("ops_auto.ops_account_management_board.save_details_p9xxvj")} </button>
                    <button
                      className="button-secondary"
                      disabled={isWorking || isCurrentAccount}
                      onClick={() => void rotateSessions(account, false)}
                      type="button"
                    >
                      {i18n.t("ops_auto.ops_account_management_board.force_sign_out_everywhere_juld6v")} </button>
                    <button
                      className="button-secondary"
                      disabled={isWorking || isCurrentAccount || passwordDraft.trim().length === 0}
                      onClick={() => void rotateSessions(account, true)}
                      type="button"
                    >
                      {i18n.t("ops_auto.ops_account_management_board.replace_password_and_revoke_sessions_7yd22d")} </button>
                    <button
                      className="button-secondary"
                      disabled={isWorking || isCurrentAccount || !account.isActive}
                      onClick={() => void updateAccess(account, "deactivate")}
                      type="button"
                    >
                      {i18n.t("ops_auto.ops_account_management_board.deactivate_account_ksc1i9")} </button>
                    <button
                      className="button-secondary"
                      disabled={isWorking || isCurrentAccount || account.isActive}
                      onClick={() => void updateAccess(account, "reactivate")}
                      type="button"
                    >
                      {i18n.t("ops_auto.ops_account_management_board.reactivate_account_30u443")} </button>
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
                      {i18n.t("ops_auto.ops_account_management_board.clear_auth_lock_xtw9c")} </button>
                  </div>
                  {isCurrentAccount ? (
                    <p>{i18n.t("ops_auto.ops_account_management_board.for_safety_the_dashboard_does_not_let_you_qta7qe")}</p>
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
