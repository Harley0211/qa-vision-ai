import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";
import { validateUrl } from "../utils/url.validator.js";

// ES modules don't have __dirname, so we rebuild it.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// backend/src/browser -> backend/storage/screenshots
const SCREENSHOT_DIR = path.resolve(__dirname, "../../storage/screenshots");

const NAVIGATION_TIMEOUT_MS =
  Number(process.env.NAVIGATION_TIMEOUT_MS) || 30000;
const HEADLESS = process.env.HEADLESS !== "false";

// Only these protocols may be requested by the page itself.
const SAFE_REQUEST_PROTOCOLS = ["http:", "https:", "data:", "blob:"];

/**
 * Installs a request filter on the browser context.
 * Every request (including redirects and sub-resources) passes through here.
 */
async function installRequestGuard(context) {
  // Cache verdicts per hostname so we don't resolve DNS for every image.
  const hostVerdicts = new Map();

  await context.route("**/*", async (route) => {
    const requestUrl = route.request().url();

    let protocol;
    try {
      protocol = new URL(requestUrl).protocol;
    } catch {
      return route.abort("blockedbyclient");
    }

    // data: and blob: URLs never touch the network.
    if (protocol === "data:" || protocol === "blob:") {
      return route.continue();
    }

    if (!SAFE_REQUEST_PROTOCOLS.includes(protocol)) {
      return route.abort("blockedbyclient");
    }

    const { hostname } = new URL(requestUrl);

    if (!hostVerdicts.has(hostname)) {
      try {
        await validateUrl(requestUrl);
        hostVerdicts.set(hostname, true);
      } catch {
        hostVerdicts.set(hostname, false);
      }
    }

    if (hostVerdicts.get(hostname)) {
      return route.continue();
    }

    console.warn(`[request-guard] Blocked request to ${requestUrl}`);
    return route.abort("blockedbyclient");
  });
}

/**
 * Opens a URL in Chromium, captures a screenshot, and returns page details.
 * The `onPageReady` callback receives the live Playwright page so other modules
 * (like the element extractor) can inspect it before the browser closes.
 */
export async function scanPage(inputUrl, { onPageReady } = {}) {
  // 1. Validate BEFORE launching anything.
  const safeUrl = await validateUrl(inputUrl);

  let browser;

  try {
    // 2. Launch browser and an isolated context.
    browser = await chromium.launch({ headless: HEADLESS });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      ignoreHTTPSErrors: false,
      acceptDownloads: false,
      serviceWorkers: "block",
    });

    await installRequestGuard(context);

    const page = await context.newPage();
    page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);

    // 3. Navigate.
    const response = await page.goto(safeUrl, { waitUntil: "load" });

    // 4. Give the page a chance to settle, but don't hang forever.
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {
      // Some sites keep polling forever. That's fine, continue anyway.
    });

    // 5. Screenshot.
    await mkdir(SCREENSHOT_DIR, { recursive: true });
    const screenshotFile = path.join(SCREENSHOT_DIR, "latest_scan.png");
    await page.screenshot({ path: screenshotFile, fullPage: true });

    // 6. Let other modules inspect the live page (DOM extraction comes next step).
    const extra = onPageReady ? await onPageReady(page) : undefined;

    return {
      url: page.url(),
      title: await page.title(),
      status_code: response ? response.status() : null,
      screenshot: "storage/screenshots/latest_scan.png",
      extra,
    };
  } finally {
    // 7. ALWAYS close, even if goto() or screenshot() threw.
    if (browser) {
      await browser.close();
    }
  }
}
