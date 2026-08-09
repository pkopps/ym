"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AccountSecuritySettings,
  TwoFactorChallengeResponse,
  TwoFactorMethod
} from "@yardmatch/contracts";
import { useI18n } from "@yardmatch/i18n/react";
import {
  clearStoredSession,
  createWebApiClient,
  getWebAuthDevice
} from "../lib/api";
import { useStoredWebSession } from "../lib/session";

export function SecuritySettingsPanel() {
  const i18n = useI18n();
  const { session, sessionReady } = useStoredWebSession();
  const [settings, setSettings] = useState<AccountSecuritySettings>();
  const [method, setMethod] = useState<TwoFactorMethod>("email");
  const [challenge, setChallenge] = useState<TwoFactorChallengeResponse>();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();

  const loadSettings = useCallback(async () => {
    if (!session) {
      return;
    }
    const device = getWebAuthDevice();
    const api = createWebApiClient(i18n.locale);
    api.setAuthToken(session.token);
    const nextSettings = await api.getSecuritySettings(device.id);
    setSettings(nextSettings);
    setMethod(nextSettings.method ?? "email");
  }, [i18n.locale, session]);

  useEffect(() => {
    if (!sessionReady || !session) {
      return;
    }
    void loadSettings().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("security.error.load"));
    });
  }, [i18n, loadSettings, session, sessionReady]);

  function authenticatedApi() {
    const api = createWebApiClient(i18n.locale);
    api.setAuthToken(session?.token);
    return api;
  }

  async function beginSetup() {
    setIsWorking(true);
    setErrorMessage(undefined);
    setStatusMessage(undefined);
    try {
      setChallenge(await authenticatedApi().beginTwoFactorSetup({ method, device: getWebAuthDevice() }));
      setCode("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("security.error.load"));
    } finally {
      setIsWorking(false);
    }
  }

  async function confirmSetup() {
    if (!challenge) {
      return;
    }
    setIsWorking(true);
    setErrorMessage(undefined);
    try {
      await authenticatedApi().confirmTwoFactorSetup({
        challengeToken: challenge.challengeToken,
        code,
        rememberDevice: true
      });
      setChallenge(undefined);
      setCode("");
      setStatusMessage(i18n.t("security.status.updated"));
      await loadSettings();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("security.error.load"));
    } finally {
      setIsWorking(false);
    }
  }

  async function disableTwoFactor() {
    setIsWorking(true);
    setErrorMessage(undefined);
    try {
      setSettings(await authenticatedApi().disableTwoFactor({ password }));
      setPassword("");
      setStatusMessage(i18n.t("security.status.updated"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("security.error.load"));
    } finally {
      setIsWorking(false);
    }
  }

  async function revokeDevice(trustedDeviceId: string) {
    setIsWorking(true);
    setErrorMessage(undefined);
    try {
      await authenticatedApi().revokeTrustedDevice({ trustedDeviceId });
      setStatusMessage(i18n.t("security.status.updated"));
      await loadSettings();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("security.error.load"));
    } finally {
      setIsWorking(false);
    }
  }

  async function revokeAllSessions() {
    setIsWorking(true);
    setErrorMessage(undefined);
    try {
      await authenticatedApi().revokeOtherSessions();
      clearStoredSession("invalidated");
      window.location.href = "/login";
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : i18n.t("security.error.load"));
      setIsWorking(false);
    }
  }

  if (sessionReady && !session) {
    return (
      <section className="card">
        <h2>{i18n.t("security.title")}</h2>
        <a className="button" href="/login">{i18n.t("nav.log_in")}</a>
      </section>
    );
  }

  return (
    <div className="stack-lg">
      {statusMessage ? <div className="list-panel" role="status"><p>{statusMessage}</p></div> : null}
      {errorMessage ? <div className="list-panel" role="alert"><p>{errorMessage}</p></div> : null}

      <section className="card auth-form-stack">
        <div>
          <span className="eyebrow">{i18n.t("security.eyebrow")}</span>
          <h2>{i18n.t("security.two_factor.title")}</h2>
          <p>
            {settings?.twoFactorEnabled && settings.destinationHint && settings.method
              ? i18n.t("security.two_factor.on", {
                  destination: settings.destinationHint,
                  method: i18n.t(settings.method === "sms" ? "security.method.sms" : "security.method.email")
                })
              : i18n.t("security.two_factor.off")}
          </p>
        </div>

        <>
          <label className="form-field">
            <span>{i18n.t("security.method.choose")}</span>
            <select onChange={(event) => setMethod(event.target.value as TwoFactorMethod)} value={method}>
              <option value="email">{i18n.t("security.method.email")}</option>
              <option value="sms">{i18n.t("security.method.sms")}</option>
            </select>
          </label>
          {challenge ? (
            <>
              <p>{i18n.t("security.setup.sent", { destination: challenge.destinationHint })}</p>
              {challenge.codePreview ? <p>{i18n.t("security.setup.local_preview", { code: challenge.codePreview })}</p> : null}
              <label className="form-field">
                <span>{i18n.t("security.setup.code")}</span>
                <input
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                  value={code}
                />
              </label>
            </>
          ) : null}
          <div className="cta-row">
            {challenge ? (
              <button className="button" disabled={isWorking || code.length !== 6} onClick={() => void confirmSetup()} type="button">
                {i18n.t("security.setup.confirm")}
              </button>
            ) : (
              <button className="button" disabled={isWorking} onClick={() => void beginSetup()} type="button">
                {i18n.t("security.setup.send")}
              </button>
            )}
          </div>
        </>

        {settings?.twoFactorEnabled && !challenge ? (
          <div className="form-grid">
            <label className="form-field">
              <span>{i18n.t("security.disable.password")}</span>
              <input onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
            </label>
            <button className="button-secondary" disabled={isWorking || !password} onClick={() => void disableTwoFactor()} type="button">
              {i18n.t("security.disable.action")}
            </button>
          </div>
        ) : null}
      </section>

      <section className="card">
        <h2>{i18n.t("security.alerts.title")}</h2>
        <p>{i18n.t("security.alerts.body")}</p>
      </section>

      <section className="card stack-lg">
        <h2>{i18n.t("security.devices.title")}</h2>
        {settings?.trustedDevices.length ? settings.trustedDevices.map((device) => (
          <article className="list-panel" key={device.id}>
            <h3>{device.label}{device.isCurrentDevice ? ` · ${i18n.t("security.devices.current")}` : ""}</h3>
            <p>{i18n.t("security.devices.last_seen", { date: i18n.formatDate(device.lastSeenAt) })}</p>
            <p>{i18n.t("security.devices.expires", { date: i18n.formatDate(device.expiresAtIso) })}</p>
            <button className="button-secondary" disabled={isWorking} onClick={() => void revokeDevice(device.id)} type="button">
              {i18n.t("security.devices.remove")}
            </button>
          </article>
        )) : <p>{i18n.t("security.devices.empty")}</p>}
        <p>{i18n.t("security.sessions.warning")}</p>
        <button className="button-secondary" disabled={isWorking} onClick={() => void revokeAllSessions()} type="button">
          {i18n.t("security.sessions.revoke")}
        </button>
      </section>

      <section className="card stack-lg">
        <h2>{i18n.t("security.activity.title")}</h2>
        {settings?.recentActivity.length ? settings.recentActivity.map((activity) => (
          <article className="list-panel" key={activity.id}>
            <strong>{activity.detail}</strong>
            <p>{i18n.formatDate(activity.occurredAt, { dateStyle: "medium", timeStyle: "short" })}</p>
          </article>
        )) : <p>{i18n.t("security.activity.empty")}</p>}
      </section>
    </div>
  );
}
