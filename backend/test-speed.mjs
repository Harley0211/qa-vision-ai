import "dotenv/config";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.AI_API_KEY,
  baseURL: process.env.AI_BASE_URL,
  timeout: 25_000, // fail fast
  maxRetries: 0, // no hidden retries, so timings are honest
});

const candidates = [
  "gemini-3.8-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
];

for (const model of candidates) {
  const start = Date.now();
  try {
    const res = await client.chat.completions.create({
      model,
      messages: [
        { role: "user", content: "Reply with the single word: ready" },
      ],
      max_tokens: 500,
    });
    const secs = ((Date.now() - start) / 1000).toFixed(1);
    console.log(
      `OK    ${model}  ${secs}s  -> ${JSON.stringify(res.choices[0]?.message?.content)}`,
    );
  } catch (err) {
    const secs = ((Date.now() - start) / 1000).toFixed(1);
    console.log(
      `FAIL  ${model}  ${secs}s  -> ${err.status ?? ""} ${String(err.message).slice(0, 150)}`,
    );
  }
}
