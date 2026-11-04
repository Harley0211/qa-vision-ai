import "dotenv/config";
import OpenAI from "openai";

console.log("Base URL:", JSON.stringify(process.env.AI_BASE_URL));
console.log("Model setting:", JSON.stringify(process.env.AI_MODEL));
console.log("Key present:", Boolean(process.env.AI_API_KEY));

const client = new OpenAI({
  apiKey: process.env.AI_API_KEY,
  baseURL: process.env.AI_BASE_URL,
});

try {
  const ids = [];
  for await (const model of client.models.list()) {
    ids.push(model.id);
  }
  console.log(`Total models visible: ${ids.length}`);
  console.log(ids.filter((id) => /flash/i.test(id)).join("\n"));
} catch (err) {
  console.error("List failed:", err.status, "-", err.message);
}
