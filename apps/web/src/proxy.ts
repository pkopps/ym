import { NextRequest, NextResponse } from "next/server";
import { resolveLocale, stripLocalePrefix } from "@yardmatch/i18n";

const localeCookieName = "ym-locale";
const staticPathPattern = /^\/(?:_next|media|favicon\.ico|robots\.txt|sitemap\.xml)/;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (staticPathPattern.test(pathname)) {
    return NextResponse.next();
  }

  const stripped = stripLocalePrefix(pathname);
  const locale = stripped.locale ?? resolveLocale({
    persistedLocale: request.cookies.get(localeCookieName)?.value,
    acceptLanguage: request.headers.get("accept-language")
  });
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
