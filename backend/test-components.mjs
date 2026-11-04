import "dotenv/config";
import { collectPageData } from "./src/browser/page.analyzer.js";
import { buildSnapshot } from "./src/ai/snapshot.builder.js";
import { classifyPage } from "./src/ai/page.classifier.js";
import { analyzeScreenshot } from "./src/ai/vision.analyzer.js";
import { identifyComponents } from "./src/ai/component.identifier.js";

const url = process.argv[2] || "https://example.com";

try {
  const data = await collectPageData(url);
  const { snapshot } = buildSnapshot(data);

  const page = await classifyPage(snapshot);
  const vision = await analyzeScreenshot({
    url: data.url,
    title: data.title,
    imageBuffer: data.viewport_image,
  });
  console.log(`Page type: ${page.page_type} (confidence ${page.confidence})`);

  const t = Date.now();
  const result = await identifyComponents(snapshot, {
    page_type: page.page_type,
    summary: page.summary,
    layout_summary: vision.layout_summary,
  });
  console.log(`Components call: ${((Date.now() - t) / 1000).toFixed(1)}s`);

  for (const c of result.components) {
    const flag = c.risk_raised_by_rules ? " (raised by safety rules)" : "";
    const hidden = c.visible_to_user ? "" : " (hidden)";
    console.log(
      `\n[${c.interaction_risk.toUpperCase()}${flag}] ${c.name} <${c.kind}>${hidden}`,
    );
    console.log(`  Purpose: ${c.purpose}`);
    console.log(`  Why: ${c.risk_reason}`);
    console.log(
      `  Elements: ${c.elements.map((e) => `${e.ref}="${e.label}"`).join(", ")}`,
    );
  }
  console.log(
    `\nVisible controls not assigned to any component: ${result.unassigned_visible_controls}`,
  );
} catch (err) {
  console.error("Failed:", err.name, "-", err.message);
}
