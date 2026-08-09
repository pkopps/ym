"use client";

import { useState } from "react";
import {
  AuthenticatedUserEnvelope,
  MarketplaceRole,
  TwoFactorChallengeResponse
} from "@yardmatch/contracts";
import { addLocalePrefix, stripLocalePrefix, type TranslationKey } from "@yardmatch/i18n";
import { useI18n } from "@yardmatch/i18n/react";
import { useRouter, useSearchParams } from "next/navigation";
import { getWebAuthDevice, saveStoredSession } from "../lib/api";
import { createWebApiClient } from "../lib/api";
import { getRoleRedirectPath } from "../lib/redirects";
import { buildSocialAuthRedirectUri } from "../lib/socialAuth";
import { AuthIdentityOptions } from "./SignupIdentityOptions";

const roleCopy: Record<
  MarketplaceRole,
  {
    helperKey: TranslationKey;
    redirectPath: string;
  }
> = {
  customer: {
    helperKey: "login_card.customer.helper",
    redirectPath: "/customer/dashboard"
  },
  provider: {
    helperKey: "login_card.provider.helper",
    redirectPath: "/provider/management"
  },
  ops: {
    helperKey: "login_card.ops.helper",
    redirectPath: "/ops"
  },
  "crew-member": {
    helperKey: "login_card.crew.helper",
    redirectPath: "/crew"
  }
};

export function RoleLoginCard({
  role
}: {
  role: MarketplaceRole;
}) {
  const i18n = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = getRoleRedirectPath(role, searchParams.get("returnTo"), roleCopy[role].redirectPath);
  const localizedRedirectPath = stripLocalePrefix(redirectPath).locale
    ? redirectPath
    : addLocalePrefix(redirectPath, i18n.locale);
  const socialRedirectUri = buildSocialAuthRedirectUri({ role, returnTo: localizedRedirectPath });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState<string | undefined>();
  const [resetCodePreview, setResetCodePreview] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRequestingReset, setIsRequestingReset] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [twoFactorChallenge, setTwoFactorChallenge] = useState<TwoFactorChallengeResponse | undefined>();
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);

  function completeAuthentication(envelope: AuthenticatedUserEnvelope) {
    if (envelope.user.role !== role) {
      throw new Error(
        i18n.t("login_card.error.role_mismatch", {
          actualRole: envelope.user.role,
          expectedRole: role
        })
      );
    }

    saveStoredSession({
      token: envelope.session.token,
      role: envelope.user.role,
      internalScope: envelope.user.role === "ops" ? envelope.user.internalScope : undefined,
      email: envelope.user.email,
      userId: envelope.user.id,
      fullName: envelope.user.fullName,
      expiresAtIso: envelope.session.expiresAtIso
    });
    router.push(localizedRedirectPath);
    router.refresh();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(undefined);

    try {
      const api = createWebApiClient(i18n.locale);
      const envelope = await api.login({
        email: email.trim(),
        password,
        device: getWebAuthDevice()
      });

      if ("twoFactorRequired" in envelope) {
        setTwoFactorChallenge(envelope);
        setTwoFactorCode("");
        return;
      }
      completeAuthentication(envelope);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("login_card.error.login_failed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRequestReset() {
    setIsRequestingReset(true);
    setErrorMessage(undefined);
    setRecoveryMessage(undefined);

    try {
      const api = createWebApiClient(i18n.locale);
      const result = await api.requestPasswordReset({
        email: email.trim()
      });
      setShowRecovery(true);
      setResetCodePreview(result.resetCodePreview);
      setRecoveryMessage(result.message);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("login_card.error.reset_start_failed"));
    } finally {
      setIsRequestingReset(false);
    }
  }

  async function handleConfirmReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsResettingPassword(true);
    setErrorMessage(undefined);
    setRecoveryMessage(undefined);

    try {
      const api = createWebApiClient(i18n.locale);
      const envelope = await api.confirmPasswordReset({
        email: email.trim(),
        resetCode: recoveryCode.trim(),
        newPassword,
        device: getWebAuthDevice()
      });
      if ("twoFactorRequired" in envelope) {
        setTwoFactorChallenge(envelope);
        setShowRecovery(false);
        return;
      }
      completeAuthentication(envelope);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("login_card.error.reset_failed"));
    } finally {
      setIsResettingPassword(false);
    }
  }

  async function handleVerifyTwoFactor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!twoFactorChallenge) {
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(undefined);
    try {
      const api = createWebApiClient(i18n.locale);
      const envelope = await api.verifyTwoFactorLogin({
        challengeToken: twoFactorChallenge.challengeToken,
        code: twoFactorCode.trim(),
        rememberDevice
      });
      completeAuthentication(envelope);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("login_card.error.login_failed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendTwoFactor() {
    if (!twoFactorChallenge) {
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(undefined);
    try {
      const api = createWebApiClient(i18n.locale);
      setTwoFactorChallenge(
        await api.resendTwoFactorChallenge({ challengeToken: twoFactorChallenge.challengeToken })
      );
      setTwoFactorCode("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("login_card.error.login_failed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="card auth-form-card">
      {errorMessage ? (
        <div className="list-panel" role="alert">
          <strong>{i18n.t("login_card.error_title")}</strong>
          <p>{errorMessage}</p>
        </div>
      ) : null}

      {!twoFactorChallenge ? <form className="auth-form-stack" onSubmit={handleSubmit}>
        <div className="auth-form-card__header">
          <h3>{i18n.t("login_card.title")}</h3>
          <p>{i18n.t(roleCopy[role].helperKey)}</p>
        </div>
        <div className="form-grid">
          <label className="form-field">
            <span>{i18n.t("auth_signup.field.email")}</span>
            <input
              onChange={(event) => setEmail(event.target.value)}
              placeholder={i18n.t("auth_signup.placeholder.email")}
              value={email}
            />
          </label>
          <label className="form-field">
            <span>{i18n.t("auth_signup.field.password")}</span>
            <input
              onChange={(event) => setPassword(event.target.value)}
              placeholder={i18n.t("login_card.password_placeholder")}
              type="password"
              value={password}
            />
          </label>
        </div>

        <div className="cta-row">
          <button className="button" disabled={isSubmitting} type="submit">
            {isSubmitting ? i18n.t("login_card.logging_in") : i18n.t("login_card.submit")}
          </button>
          <button
            className="button-secondary"
            disabled={isRequestingReset}
            onClick={() => void handleRequestReset()}
            type="button"
          >
            {isRequestingReset ? i18n.t("login_card.sending_code") : i18n.t("login_card.forgot_password")}
          </button>
          <a className="button-secondary" href={addLocalePrefix("/login", i18n.locale)}>
            {i18n.t("common.actions.back")}
          </a>
        </div>

        {role === "ops" ? null : <AuthIdentityOptions mode="login" redirectUri={socialRedirectUri} role={role} />}
      </form> : null}

      {twoFactorChallenge ? (
        <form className="auth-form-stack" onSubmit={handleVerifyTwoFactor}>
          <div className="auth-form-card__header">
            <h3>{i18n.t("security.challenge.title")}</h3>
            <p>{i18n.t("security.challenge.body", { destination: twoFactorChallenge.destinationHint })}</p>
            {twoFactorChallenge.codePreview ? (
              <p>{i18n.t("security.setup.local_preview", { code: twoFactorChallenge.codePreview })}</p>
            ) : null}
          </div>
          <label className="form-field">
            <span>{i18n.t("security.setup.code")}</span>
            <input
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) => setTwoFactorCode(event.target.value.replace(/\D/g, ""))}
              value={twoFactorCode}
            />
          </label>
          <label className="form-field form-field--checkbox">
            <input
              checked={rememberDevice}
              onChange={(event) => setRememberDevice(event.target.checked)}
              type="checkbox"
            />
            <span>{i18n.t("security.challenge.remember")}</span>
          </label>
          <div className="cta-row">
            <button className="button" disabled={isSubmitting || twoFactorCode.length !== 6} type="submit">
              {i18n.t("security.challenge.verify")}
            </button>
            <button className="button-secondary" disabled={isSubmitting} onClick={() => void handleResendTwoFactor()} type="button">
              {i18n.t("security.challenge.resend")}
            </button>
            <button
              className="button-secondary"
              onClick={() => {
                setTwoFactorChallenge(undefined);
                setTwoFactorCode("");
                setErrorMessage(undefined);
              }}
              type="button"
            >
              {i18n.t("security.challenge.cancel")}
            </button>
          </div>
        </form>
      ) : null}

      {showRecovery && !twoFactorChallenge ? (
        <form className="auth-form-stack" onSubmit={handleConfirmReset}>
          <div className="list-panel">
            <strong>{i18n.t("login_card.reset.title")}</strong>
            <p>{i18n.t("login_card.reset.body", { email: email.trim() || i18n.t("login_card.reset.your_account") })}</p>
          </div>

          {recoveryMessage ? (
            <div className="list-panel">
              <strong>{i18n.t("login_card.reset.started")}</strong>
              <p>{recoveryMessage}</p>
              {resetCodePreview ? <p>{i18n.t("login_card.reset.local_code", { code: resetCodePreview })}</p> : null}
            </div>
          ) : null}

          <div className="form-grid">
            <label className="form-field">
              <span>{i18n.t("login_card.reset.code")}</span>
              <input onChange={(event) => setRecoveryCode(event.target.value)} value={recoveryCode} />
            </label>
            <label className="form-field">
              <span>{i18n.t("login_card.reset.new_password")}</span>
              <input
                onChange={(event) => setNewPassword(event.target.value)}
                type="password"
                value={newPassword}
              />
            </label>
          </div>

          <div className="cta-row">
            <button className="button" disabled={isResettingPassword} type="submit">
              {isResettingPassword ? i18n.t("login_card.reset.updating") : i18n.t("login_card.reset.submit")}
            </button>
            <button
              className="button-secondary"
              onClick={() => {
                setShowRecovery(false);
                setRecoveryCode("");
                setNewPassword("");
                setRecoveryMessage(undefined);
                setResetCodePreview(undefined);
              }}
              type="button"
            >
              {i18n.t("common.actions.close")}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
