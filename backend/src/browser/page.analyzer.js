import { scanPage } from "./browser.manager.js";
import { extractElements } from "./element.extractor.js";
import { extractPageContext } from "./page.context.js";

// Runs both extractors on the live page at the same time.
async function collectFromPage(page) {
  const [elements, context] = await Promise.all([
    extractElements(page),
    extractPageContext(page),
  ]);
  return { elements, context };
}

/**
 * Scans a URL and returns everything we know about it, including page context.
 * Used by the AI steps.
 */
export async function collectPageData(url) {
  const result = await scanPage(url, { onPageReady: collectFromPage });

  return {
    url: result.url,
    title: result.title,
    status_code: result.status_code,
    screenshot: result.screenshot,
    viewport_image: result.viewport_image, // <-- new
    elements: result.extra.elements,
    context: result.extra.context,
  };
}

/**
 * Phase 1 API result for POST /api/scan. Same shape as before: no context field.
 */
export async function analyzeWebsite(url) {
  const { context, viewport_image, ...analysis } = await collectPageData(url);
  return analysis;
}
