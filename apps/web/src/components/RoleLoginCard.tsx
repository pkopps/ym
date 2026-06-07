"use client";

import { useState } from "react";
import { MarketplaceRole } from "@yardmatch/contracts";
import { useRouter } from "next/navigation";
import { saveStoredSession } from "../lib/api";
import { createWebApiClient } from "../lib/api";
import { AuthIdentityOptions } from "./SignupIdentityOptions";

const roleCopy: Record<
  MarketplaceRole,
  {
    demoEmail: string;
    demoPassword: string;
    redirectPath: string;
  }
> = {
  customer: {
    demoEmail: "jordan@example.com",
    demoPassword: "YardMatch123!",
    redirectPath: "/customer"
  },
  provider: {
    demoEmail: "ariana@greenstride.example",
    demoPassword: "YardMatch123!",
    redirectPath: "/provider/management"
  },
  "crew-member": {
    demoEmail: "crew@example.com",
    demoPassword: "YardMatch123!",
    redirectPath: "/crew"
  }
};

export function RoleLoginCard({
  role
}: {
  role: MarketplaceRole;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(roleCopy[role].demoEmail);
  const [password, setPassword] = useState(roleCopy[role].demoPassword);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState<string | undefined>();
  const [resetCodePreview, setResetCodePreview] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRequestingReset, setIsRequestingReset] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(undefined);

    try {
      const api = createWebApiClient();
      const envelope = await api.login({
        email: email.trim(),
        password
      });

      if (envelope.user.role !== role) {
        throw new Error(`This account is for ${envelope.user.role}, not ${role}.`);
      }

      saveStoredSession({
        token: envelope.session.token,
        role: envelope.user.role,
        email: envelope.user.email,
        userId: envelope.user.id,
        fullName: envelope.user.fullName,
        expiresAtIso: envelope.session.expiresAtIso
      });

      router.push(roleCopy[role].redirectPath);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to log in right now.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRequestReset() {
    setIsRequestingReset(true);
    setErrorMessage(undefined);
    setRecoveryMessage(undefined);

    try {
      const api = createWebApiClient();
      const result = await api.requestPasswordReset({
        email: email.trim()
      });
      setShowRecovery(true);
      setResetCodePreview(result.resetCodePreview);
      setRecoveryMessage(result.message);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to start password reset right now.");
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
      const api = createWebApiClient();
      const envelope = await api.confirmPasswordReset({
        email: email.trim(),
        resetCode: recoveryCode.trim(),
        newPassword
      });

      saveStoredSession({
        token: envelope.session.token,
        role: envelope.user.role,
        email: envelope.user.email,
        userId: envelope.user.id,
        fullName: envelope.user.fullName,
        expiresAtIso: envelope.session.expiresAtIso
      });

      router.push(roleCopy[role].redirectPath);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to reset the password right now.");
    } finally {
      setIsResettingPassword(false);
    }
  }

  return (
    <section className="card auth-form-card">
      <form className="auth-form-stack" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="form-field">
            <span>Email</span>
            <input onChange={(event) => setEmail(event.target.value)} value={email} />
          </label>
          <label className="form-field">
            <span>Password</span>
            <input
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>
        </div>

        <div className="list-panel">
          <strong>Seeded test account</strong>
          <p>
            {roleCopy[role].demoEmail} • {roleCopy[role].demoPassword}
          </p>
        </div>

        {errorMessage ? (
          <div className="list-panel" role="alert">
            <strong>Login failed</strong>
            <p>{errorMessage}</p>
          </div>
        ) : null}

        <div className="cta-row">
          <button className="button" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Logging in..." : "Log in"}
          </button>
          <button
            className="button-secondary"
            disabled={isRequestingReset}
            onClick={() => void handleRequestReset()}
            type="button"
          >
            {isRequestingReset ? "Sending code..." : "Forgot password?"}
          </button>
          <a className="button-secondary" href="/login">
            Back
          </a>
        </div>

        <AuthIdentityOptions mode="login" role={role} />
      </form>

      {showRecovery ? (
        <form className="auth-form-stack" onSubmit={handleConfirmReset}>
          <div className="list-panel">
            <strong>Reset your password</strong>
            <p>Enter the latest reset code for {email.trim() || "your account"} and choose a new password.</p>
          </div>

          {recoveryMessage ? (
            <div className="list-panel">
              <strong>Reset started</strong>
              <p>{recoveryMessage}</p>
              {resetCodePreview ? <p>Local preview code: {resetCodePreview}</p> : null}
            </div>
          ) : null}

          <div className="form-grid">
            <label className="form-field">
              <span>Reset code</span>
              <input onChange={(event) => setRecoveryCode(event.target.value)} value={recoveryCode} />
            </label>
            <label className="form-field">
              <span>New password</span>
              <input
                onChange={(event) => setNewPassword(event.target.value)}
                type="password"
                value={newPassword}
              />
            </label>
          </div>

          <div className="cta-row">
            <button className="button" disabled={isResettingPassword} type="submit">
              {isResettingPassword ? "Updating..." : "Reset password"}
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
              Close
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
