import { collectPageData } from "../browser/page.analyzer.js";
import { buildSnapshot } from "./snapshot.builder.js";
import { classifyPage } from "./page.classifier.js";
import { analyzeScreenshot } from "./vision.analyzer.js";
import { identifyComponents } from "./component.identifier.js";
import { getModel } from "./ai.client.js";

const errText = (err) => err?.message ?? "Unknown error";

/**
 * Full Phase 2 pipeline: scan -> snapshot -> classify (+ vision) -> components.
 * Classification is required. Vision and components degrade into warnings.
 */
export async function analyzePageWithAi(url, { includeVision = true } = {}) {
  const timings = {};
  const warnings = [];

  // Runs fn and records how long it took, even if it throws.
  const time = async (name, fn) => {
    const start = Date.now();
    try {
      return await fn();
    } finally {
      timings[name] = Date.now() - start;
    }
  };

  // 1. Browser scan (validates the URL first)
  const data = await time("scan_ms", () => collectPageData(url));
  const { snapshot, stats } = buildSnapshot(data);

  // 2. Classification and vision are independent, so run them together.
  const [classification, vision] = await Promise.all([
    time("classify_ms", () => classifyPage(snapshot)),
    includeVision
      ? time("vision_ms", () =>
          analyzeScreenshot({
            url: data.url,
            title: data.title,
            imageBuffer: data.viewport_image,
          }),
        ).catch((err) => {
          warnings.push(`Vision analysis skipped: ${errText(err)}`);
          return null;
        })
      : null,
  ]);

  // 3. Components use both earlier results as context.
  let components = null;
  try {
    components = await time("components_ms", () =>
      identifyComponents(snapshot, {
        page_type: classification.page_type,
        summary: classification.summary,
        layout_summary: vision?.layout_summary,
      }),
    );
  } catch (err) {
    warnings.push(`Component identification skipped: ${errText(err)}`);
  }

  return {
    page: {
      url: data.url,
      title: data.title,
      status_code: data.status_code,
      screenshot: data.screenshot,
    },
    classification,
    vision,
    components,
    snapshot_stats: stats,
    model: getModel(),
    warnings,
    timings_ms: timings,
  };
}
