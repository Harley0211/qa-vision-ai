import "dotenv/config";
import { collectPageData } from "./src/browser/page.analyzer.js";
import { analyzeScreenshot } from "./src/ai/vision.analyzer.js";

const url = process.argv[2] || "https://example.com";

try {
  const data = await collectPageData(url);
  console.log(
    `Viewport image: ${(data.viewport_image.length / 1024).toFixed(0)} KB`,
  );

  const t = Date.now();
  const result = await analyzeScreenshot({
    url: data.url,
    title: data.title,
    imageBuffer: data.viewport_image,
  });
  console.log(`AI call: ${((Date.now() - t) / 1000).toFixed(1)}s`);
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error("Failed:", err.name, "-", err.message);
}
