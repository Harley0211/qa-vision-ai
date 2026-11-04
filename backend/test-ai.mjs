import "dotenv/config";
import { askText, getModel } from "./src/ai/ai.client.js";

try {
  console.log("Using model:", getModel());
  const reply = await askText({
    instructions: "Reply with exactly one short sentence.",
    input: "Say hello to the QA Vision AI project.",
  });
  console.log("Model reply:", reply);
} catch (err) {
  console.error("AI call failed:", err.name, "-", err.message);
}
