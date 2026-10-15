import { test as base, type BrowserContext, type Page } from "@playwright/test";

export { expect } from "@playwright/test";
export type { APIRequestContext, Locator, Page } from "@playwright/test";

/**
 * Next dev serves the HTML and fires `load` before React finishes hydrating, so a
 * test that selects, types, or presses Enter straight after `goto` can act on inert
 * server markup: controlled inputs snap back and forms fall through to a native GET.
 * Wait until every interactive element carries React's props key, then let the
 * commit's effects flush before handing the page back to the test.
 */
export async function waitForHydration(page: Page) {
  for (let attempt = 0; ; attempt++) {
    try {
      await page.waitForFunction(() => {
        // Non-app responses (robots.txt, sitemap.xml, API JSON) have nothing to hydrate.
        if (!document.getElementById("main-content")) return true;
        const controls = document.body.querySelectorAll("a, button, input, select, textarea");
        return Array.from(controls)
          // Leaflet builds its own controls and markers after hydration; React never owns them.
          .filter((element) => !element.closest(".leaflet-container"))
          .every((element) => Object.keys(element).some((key) => key.startsWith("__reactProps$")));
      }, undefined, { timeout: 30_000 });
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0))));
      return;
    } catch (error) {
      // A client redirect right after load replaces the document; wait for the new one.
      if (attempt >= 3 || !/context was destroyed|navigat/i.test(String(error))) throw error;
      await page.waitForLoadState("load");
    }
  }
}

const patched = new WeakSet<Page>();

export function hydrateOnNavigation(page: Page) {
  if (patched.has(page)) return page;
  patched.add(page);
  const goto = page.goto.bind(page);
  const reload = page.reload.bind(page);
  page.goto = async (...args: Parameters<Page["goto"]>) => {
    const response = await goto(...args);
    await waitForHydration(page);
    return response;
  };
  page.reload = async (...args: Parameters<Page["reload"]>) => {
    const response = await reload(...args);
    await waitForHydration(page);
    return response;
  };
  return page;
}

export function hydrateContextNavigation(context: BrowserContext) {
  context.pages().forEach(hydrateOnNavigation);
  context.on("page", hydrateOnNavigation);
  return context;
}

export const test = base.extend({
  context: async ({ context }, use) => {
    await use(hydrateContextNavigation(context));
  },
  page: async ({ page }, use) => {
    await use(hydrateOnNavigation(page));
  }
});
