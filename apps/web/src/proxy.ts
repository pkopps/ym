import { NextRequest, NextResponse } from "next/server";
import { addLocalePrefix, stripLocalePrefix } from "@yardmatch/i18n";

const localeCookieName = "ym-locale";
const staticPathPattern = /^\/(?:_next|media|favicon\.ico|robots\.txt|sitemap\.xml)/;
// Customers, providers and crew share one login page; their former addresses still work.
const formerRoleLoginPattern = /^\/login\/(?:customer|provider|crew)\/?$/;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (staticPathPattern.test(pathname)) {
    return NextResponse.next();
  }

  const stripped = stripLocalePrefix(pathname);
  if (formerRoleLoginPattern.test(stripped.path)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = stripped.locale ? addLocalePrefix("/login", stripped.locale) : "/login";
    const returnTo = request.nextUrl.searchParams.get("returnTo");
    loginUrl.search = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
    return NextResponse.redirect(loginUrl, 307);
  }

  // A public URL must render the same language for visitors and crawlers.
  // The language picker navigates to /es (Spanish) or an unprefixed URL (English).
  const locale = stripped.locale ?? "en";
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-yardmatch-locale", locale);

  if (stripped.locale) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = stripped.path;
    const response = NextResponse.rewrite(rewriteUrl, {
      request: {
        headers: requestHeaders
      }
    });
    if (locale === "pseudo") {
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
    }
    response.cookies.set(localeCookieName, locale, {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax"
    });
    return response;
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
}

export const config = {
  matcher: ["/((?!api).*)"]
};
