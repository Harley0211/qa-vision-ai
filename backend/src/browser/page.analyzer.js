import { scanPage } from "./browser.manager.js";
import { extractElements } from "./element.extractor.js";

/**
 * Runs a full Phase 1 analysis of a URL and returns the API-shaped result.
 */
export async function analyzeWebsite(url) {
  const result = await scanPage(url, { onPageReady: extractElements });

  return {
    url: result.url,
    title: result.title,
    status_code: result.status_code,
    screenshot: result.screenshot,
    elements: result.extra,
  };
}
