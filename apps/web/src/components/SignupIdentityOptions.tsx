import { AuthFlowMode, MarketplaceApiClient, MarketplaceRole } from "@yardmatch/contracts";
import { getWebApiBaseUrl } from "../lib/api";

function GoogleLogo() {
  return (
    <svg aria-hidden="true" className="auth-provider-button__logo" viewBox="0 0 24 24">
      <path
        d="M21.8 12.23c0-.76-.07-1.49-.2-2.2H12v4.17h5.49a4.7 4.7 0 0 1-2.04 3.08v2.56h3.3c1.93-1.78 3.05-4.4 3.05-7.61Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.76 0 5.07-.91 6.76-2.47l-3.3-2.56c-.91.61-2.08.97-3.46.97-2.65 0-4.89-1.79-5.69-4.19H2.9v2.64A10 10 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.31 13.75A5.98 5.98 0 0 1 6 12c0-.61.1-1.2.31-1.75V7.61H2.9A10 10 0 0 0 2 12c0 1.61.38 3.13.9 4.39l3.41-2.64Z"
        fill="#FBBC05"
      />
      <path
        d="M12 6.06c1.5 0 2.85.52 3.91 1.52l2.94-2.94C17.06 2.98 14.75 2 12 2A10 10 0 0 0 2.9 7.61l3.41 2.64c.8-2.4 3.04-4.19 5.69-4.19Z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AppleLogo() {
  return (
    <svg aria-hidden="true" className="auth-provider-button__logo" viewBox="0 0 24 24">
      <path
        d="M16.7 12.86c.02 2.27 2 3.02 2.02 3.03-.02.05-.31 1.08-1.03 2.14-.61.92-1.26 1.83-2.26 1.85-.98.02-1.29-.58-2.41-.58-1.12 0-1.47.56-2.39.6-.96.04-1.7-.96-2.31-1.87-1.25-1.82-2.2-5.14-.92-7.36.64-1.1 1.77-1.8 3-1.82.94-.02 1.82.63 2.41.63.59 0 1.7-.78 2.87-.66.49.02 1.85.2 2.73 1.49-.07.04-1.63.95-1.61 2.55Zm-1.97-9.58c.51-.62.87-1.49.77-2.35-.74.03-1.63.5-2.16 1.11-.47.55-.89 1.44-.78 2.29.82.06 1.66-.42 2.17-1.05Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function AuthIdentityOptions({
  mode,
  redirectUri,
  role
}: {
  mode: AuthFlowMode;
  redirectUri?: string;
  role: MarketplaceRole;
}) {
  const api = new MarketplaceApiClient(getWebApiBaseUrl());

  return (
    <div className="social-auth-group">
      <a
        className="auth-provider-button"
        href={api.getGoogleAuthStartUrl({
          role,
          mode,
          redirectUri
        })}
      >
        <GoogleLogo />
        <span>Continue with Google</span>
      </a>
      <a
        className="auth-provider-button"
        href={api.getAppleAuthStartUrl({
          role,
          mode,
          redirectUri
        })}
      >
        <AppleLogo />
        <span>Continue with Apple</span>
      </a>
    </div>
  );
}

export function SignupIdentityOptions({ redirectUri, role }: { redirectUri?: string; role: MarketplaceRole }) {
  return <AuthIdentityOptions mode="signup" redirectUri={redirectUri} role={role} />;
}
