import { NextRequest, NextResponse } from "next/server";
import { stripLocalePrefix } from "@yardmatch/i18n";

const localeCookieName = "ym-locale";
const staticPathPattern = /^\/(?:_next|media|favicon\.ico|robots\.txt|sitemap\.xml)/;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (staticPathPattern.test(pathname)) {
    return NextResponse.next();
  }

  const stripped = stripLocalePrefix(pathname);
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
