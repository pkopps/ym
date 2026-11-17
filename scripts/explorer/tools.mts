/**
 * Small local-only tools for an explorer run.
 *
 *   capture        Screenshot a page at 1440x900 and 390x844, optionally signed in as the persona.
 *   expire-reset   Expire the newest password reset code for an email in the explorer database.
 *   check-session  Report whether a saved session token still works.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { userInfo } from "node:os";
import { parseArgs } from "node:util";
import { PrismaClient } from "@prisma/client";
import { chromium } from "@playwright/test";
import { assertLocalTestDatabase, assertLoopbackBaseUrl } from "../lib/local-database-guard.mts";

const [command, ...rest] = process.argv.slice(2);
const { values } = parseArgs({
  args: rest,
  options: {
    web: { type: "string" }, api: { type: "string" }, path: { type: "string", default: "/" }, out: { type: "string" }, name: { type: "string" },
    email: { type: "string" }, password: { type: "string" }, "token-file": { type: "string" }
  }
});

if (command === "capture") {
  const web = assertLoopbackBaseUrl(values.web ?? "", "--web").origin;
  const api = values.api ? assertLoopbackBaseUrl(values.api, "--api").origin : undefined;
  let session: Record<string, unknown> | undefined;
  if (values.email && values.password && api) {
    const response = await fetch(`${api}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: values.email, password: values.password }) });
    const body = await response.json() as { session?: { token: string; expiresAtIso: string }; user?: { id: string; role: string; email: string; fullName: string; internalScope?: string } };
    if (!body.session || !body.user) throw new Error(`Sign-in failed: ${response.status}`);
    session = { token: body.session.token, expiresAtIso: body.session.expiresAtIso, role: body.user.role, email: body.user.email, userId: body.user.id, fullName: body.user.fullName };
  }
  const browser = await chromium.launch();
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: viewport.width < 768, hasTouch: viewport.width < 768 });
      if (session) await context.addInitScript(value => window.localStorage.setItem("yardmatch-web-session", value), JSON.stringify(session));
      const page = await context.newPage();
      await page.goto(`${web}${values.path}`, { waitUntil: "networkidle", timeout: 60_000 });
      const file = join(values.out ?? ".", `${values.name ?? "page"}-${viewport.width}x${viewport.height}.png`);
      await page.screenshot({ path: file, fullPage: false });
      console.log(file);
      await context.close();
    }
  } finally {
    await browser.close();
  }
} else if (command === "expire-reset") {
  const url = assertLocalTestDatabase(process.env.EXPLORER_DATABASE_URL ?? `postgresql://${userInfo().username}@localhost:5432/yardmatch_explorer_test`, "EXPLORER_DATABASE_URL");
  const prisma = new PrismaClient({ datasourceUrl: url.toString() });
  try {
    const updated = await prisma.userAccount.updateMany({ where: { email: (values.email ?? "").toLowerCase(), resetPasswordCodeHash: { not: null } }, data: { resetPasswordExpiresAt: new Date(Date.now() - 60_000) } });
    console.log(updated.count ? "The newest reset code is now expired." : "No open reset code for that email.");
  } finally {
    await prisma.$disconnect();
  }
} else if (command === "check-session") {
  const api = assertLoopbackBaseUrl(values.api ?? "", "--api").origin;
  const token = readFileSync(values["token-file"] ?? "", "utf8").trim();
  const response = await fetch(`${api}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  console.log(response.ok ? "The session from before the reset STILL WORKS." : `The session from before the reset was refused (${response.status}).`);
} else {
  console.error("Usage: explorer:tools -- capture|expire-reset|check-session ...");
  process.exitCode = 1;
}
