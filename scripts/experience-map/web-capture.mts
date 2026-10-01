import fs from "node:fs";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { chromium, request as playwrightRequest, type BrowserContext, type Page } from "@playwright/test";
import sharp from "sharp";
import { appRoot, buildInventory, root } from "./inventory.mjs";
import { approveProvider, authenticatedPost, createBooking, loginApi, opsEmail, opsPassword, registerCustomer, registerProvider, testPassword, uniqueEmail } from "../../tests/web/workflow-helpers";

const apiUrl = process.env.API_BASE_URL ?? "http://localhost:4001";
const webUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const thumbnailDir = path.join(appRoot, "public/captures/thumbnails");
const fullDir = path.join(appRoot, "public/captures/full");
const manifestPath = path.join(appRoot, "captures/manifest.json");
fs.mkdirSync(thumbnailDir, { recursive: true });
fs.mkdirSync(fullDir, { recursive: true });
fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
const manifest: Record<string, { thumbnail: string; full: string; status: string; capturedAt: string; resolvedUrl?: string }> = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : {};
const processes: ChildProcess[] = [];

async function healthy(url: string) { try { const response = await fetch(url, { signal: AbortSignal.timeout(3500) }); return response.ok; } catch { return false; } }
async function waitFor(url: string, processName: string) {
  for (let attempt = 0; attempt < 80; attempt++) { if (await healthy(url)) return; await new Promise((resolve) => setTimeout(resolve, 1000)); }
  throw new Error(`${processName} did not start at ${url}`);
}
async function ensureServers() {
  if (!await healthy(`${apiUrl}/api/docs/openapi.json`)) {
    const child = spawn("npm", ["run", "dev:api"], { cwd: root, env: { ...process.env, DATABASE_URL: "", PORT: "4001" }, stdio: "ignore", detached: true });
    processes.push(child); await waitFor(`${apiUrl}/api/docs/openapi.json`, "API");
  }
  if (!await healthy(webUrl)) {
    const child = spawn("npm", ["run", "dev:web"], { cwd: root, env: { ...process.env, NEXT_PUBLIC_API_BASE_URL: apiUrl }, stdio: "ignore", detached: true });
    processes.push(child); await waitFor(webUrl, "web app");
  }
}
function stopServers() { for (const child of processes) if (child.pid) { try { process.kill(-child.pid, "SIGTERM"); } catch { /* already stopped */ } } }
const slug = (id: string) => id.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
function writeManifest(id: string) {
  const latest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : {};
  latest[id] = manifest[id];
  fs.writeFileSync(manifestPath, JSON.stringify(latest, null, 2) + "\n");
}
async function save(page: Page, id: string, status = "captured") {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle", { timeout: 3500 }).catch(() => undefined);
  await page.waitForTimeout(1200);
  const image = await page.screenshot({ fullPage: true, animations: "disabled" });
  const name = slug(id);
  const thumbnail = `captures/thumbnails/${name}.webp`;
  const full = `captures/full/${name}.png`;
  fs.writeFileSync(path.join(appRoot, "public", full), image);
  await sharp(image).resize({ width: 640, withoutEnlargement: true }).webp({ quality: 70, effort: 5 }).toFile(path.join(appRoot, "public", thumbnail));
  manifest[id] = { thumbnail, full, status, capturedAt: new Date().toISOString(), resolvedUrl: page.url() };
  writeManifest(id);
  console.log(`captured ${id}`);
}
async function openPage(page: Page, url: string) {
  const response = await page.goto(`${webUrl}${url}`, { waitUntil: "domcontentloaded", timeout: 45000 });
  if (!response?.ok()) throw new Error(`HTTP ${response?.status() ?? "unknown"}`);
  await page.locator("body").waitFor();
}
type Fixture = { token: string; role: string; email: string; userId: string; fullName: string; expiresAtIso: string; internalScope?: unknown };
async function contextFor(role: string, browser: Awaited<ReturnType<typeof chromium.launch>>, fixture?: Fixture): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: "en-US", colorScheme: "light" });
  if (fixture) await context.addInitScript((session) => { localStorage.setItem("yardmatch-web-session", JSON.stringify(session)); localStorage.setItem("yardmatch-locale", "en"); }, fixture);
  return context;
}
async function main() {
  await ensureServers();
  const browser = await chromium.launch({ headless: true });
  const api = await playwrightRequest.newContext({ baseURL: apiUrl });
  const contexts = new Map<string, BrowserContext>();
  try {
    const customer = await registerCustomer(api, "Map Customer");
    const provider = await registerProvider(api, { companyName: "Map Route Lawn", staffingMode: "auto-accept" });
    await approveProvider(api, provider.providerId, provider.token);
    const crewEmail = uniqueEmail("map-crew");
    const crewResponse = await api.post(`${apiUrl}/api/auth/register`, { data: { fullName: "Map Crew", email: crewEmail, password: testPassword, phone: "555-0182", role: "crew-member", address: { line1: "18 Bay Ave", city: "Barnegat", state: "NJ", postalCode: "08005", country: "US", point: { latitude: 42.7, longitude: -102.25 } }, categories: ["lawn-mowing"], availableWeekdays: [1,2,3,4,5], willingToTravelMiles: 20, preferredSchedule: "flexible", hasOwnEquipment: true, winterWorkEnabled: false } });
    if (!crewResponse.ok()) console.warn(`crew fixture unavailable: ${crewResponse.status()} ${await crewResponse.text()}`);
    const credentials = [
      ["customer", customer.email, testPassword], ["provider", provider.email, testPassword],
      ["crew", crewEmail, testPassword], ["ops", opsEmail, opsPassword]
    ] as const;
    for (const [role, email, password] of credentials) {
      try {
        const envelope = await loginApi(api, email, password);
        const fixture = { token: envelope.session.token, role: envelope.user.role, email: envelope.user.email, userId: envelope.user.id, fullName: (envelope.user as { fullName?: string }).fullName ?? "Map Fixture", expiresAtIso: (envelope.session as { expiresAtIso?: string }).expiresAtIso ?? new Date(Date.now() + 86400000).toISOString(), internalScope: (envelope.user as { internalScope?: unknown }).internalScope };
        contexts.set(role, await contextFor(role, browser, fixture));
      } catch (error) { console.warn(`${role} fixture unavailable: ${String(error)}`); }
    }
    fs.writeFileSync(path.join(fullDir, "mobile-fixtures.json"), JSON.stringify({ customer: { email: customer.email, password: testPassword }, provider: { email: provider.email, password: testPassword }, crew: { email: crewEmail, password: testPassword } }, null, 2));
    contexts.set("public", await contextFor("public", browser));
    const inventory = buildInventory();
    for (const node of inventory.nodes.filter((item) => item.kind === "web" && !process.argv.includes("--states-only"))) {
      const role = node.url === "/ops" ? "ops" : node.url.startsWith("/provider/") ? "provider" : node.url.startsWith("/crew/") ? "crew" : node.url.startsWith("/customer/") ? "customer" : node.url === "/account/security" ? "customer" : "public";
      const context = contexts.get(role);
      if (!context) { console.warn(`skipped ${node.id}: ${role} fixture unavailable`); continue; }
      const page = await context.newPage();
      try { await openPage(page, node.url); await save(page, node.id, new URL(page.url()).pathname === node.url ? "captured" : "redirect"); }
      catch (error) { delete manifest[node.id]; console.warn(`skipped ${node.id}: ${String(error)}`); }
      finally { await page.close(); }
    }
    const customerContext = contexts.get("customer"), providerContext = contexts.get("provider"), opsContext = contexts.get("ops");
    if (customerContext && providerContext) {
      const quotePage = await customerContext.newPage();
      try {
        await openPage(quotePage, "/customer/dashboard?flow=request");
        await quotePage.getByRole("button", { name: "Get price" }).click();
        await quotePage.getByText("Selected match", { exact: true }).first().waitFor({ timeout: 15000 });
        await save(quotePage, "customer:quote");
      } catch (error) { console.warn(`quote state: ${String(error)}`); }
      finally { await quotePage.close(); }
      const booking = await createBooking(api, { customerToken: customer.token, providerId: provider.providerId });
      const pendingPage = await customerContext.newPage();
      try { await openPage(pendingPage, "/customer/dashboard"); await pendingPage.getByText("Waiting on confirmation").first().waitFor({ timeout: 10000 }); await save(pendingPage, "customer:request-pending"); }
      catch (error) { console.warn(`pending state: ${String(error)}`); }
      finally { await pendingPage.close(); }
      const reviewPage = await providerContext.newPage();
      try { await openPage(reviewPage, "/provider/management"); await reviewPage.getByText("Map Customer").first().waitFor({ timeout: 10000 }); await save(reviewPage, "provider:review"); }
      catch (error) { console.warn(`provider review state: ${String(error)}`); }
      finally { await reviewPage.close(); }
      await authenticatedPost(api, provider.token, "/api/bookings/confirm", { bookingId: booking.id });
      for (const [id, context, url] of [["customer:confirmed", customerContext, "/customer/dashboard"], ["provider:confirmed", providerContext, "/provider/management"]] as const) {
        const page = await context.newPage(); try { await openPage(page, url); await save(page, id); } catch (error) { console.warn(`${id}: ${String(error)}`); } finally { await page.close(); }
      }
      await authenticatedPost(api, provider.token, "/api/bookings/on-route", { bookingId: booking.id });
      const routePage = await providerContext.newPage(); try { await openPage(routePage, "/provider/management"); await save(routePage, "provider:on-route"); } catch (error) { console.warn(`on-route: ${String(error)}`); } finally { await routePage.close(); }
      try {
        await authenticatedPost(api, provider.token, "/api/bookings/complete", { bookingId: booking.id });
        for (const [id, context, url] of [["provider:complete", providerContext, "/provider/management"], ["customer:history", customerContext, "/customer/history"]] as const) {
          const page = await context.newPage(); try { await openPage(page, url); await save(page, id); } catch (error) { console.warn(`${id}: ${String(error)}`); } finally { await page.close(); }
        }
      } catch (error) { console.warn(`Completion fixture requires field evidence: ${String(error)}`); }
      if (opsContext) {
        const complaint = await api.post(`${apiUrl}/api/support/complaints`, { headers: { Authorization: `Bearer ${customer.token}` }, data: { bookingId: booking.id, category: "service-quality", description: "Synthetic map fixture: grass clippings remained near the walkway after service." } });
        if (complaint.ok()) {
          const helpPage = await customerContext.newPage(); try { await openPage(helpPage, `/help?bookingId=${booking.id}&issueType=service-quality`); await save(helpPage, "customer:dispute"); } catch (error) { console.warn(`dispute: ${String(error)}`); } finally { await helpPage.close(); }
          const opsPage = await opsContext.newPage(); try { await openPage(opsPage, "/ops?view=support#ops-support"); await save(opsPage, "ops:case"); } catch (error) { console.warn(`ops case: ${String(error)}`); } finally { await opsPage.close(); }
        }
      }
    }
  } finally { for (const context of contexts.values()) await context.close(); await api.dispose(); await browser.close(); stopServers(); }
}
main().catch((error) => { stopServers(); console.error(error); process.exitCode = 1; });
