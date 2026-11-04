import OpenAI from "openai"; // the SDK works with any OpenAI-compatible API

/**
 * Custom error so the API layer can tell "AI problem" apart from "scan problem".
 */
export class AiError extends Error {
  constructor(message, statusCode = 502) {
    super(message);
    this.name = "AiError";
    this.statusCode = statusCode;
  }
}

let client; // created lazily, reused across calls

function getClient() {
  if (!process.env.AI_API_KEY) {
    throw new AiError("AI_API_KEY is missing. Add it to backend/.env", 500);
  }

  client ??= new OpenAI({
    apiKey: process.env.AI_API_KEY,
    baseURL: process.env.AI_BASE_URL || undefined, // undefined = OpenAI's default
    timeout: 60_000,
    maxRetries: 2, // retries transient errors (429, 5xx) with backoff
  });

  return client;
}

export function getModel() {
  if (!process.env.AI_MODEL) {
    throw new AiError("AI_MODEL is missing. Add it to backend/.env", 500);
  }
  return process.env.AI_MODEL;
}

/**
 * Sends a text request and returns the text reply.
 * Later steps extend this with images and structured JSON output.
 */
async function complete(messages, maxOutputTokens) {
  try {
    const response = await getClient().chat.completions.create({
      model: getModel(),
      messages,
      max_tokens: maxOutputTokens,
    });

    return response.choices[0]?.message?.content ?? "";
  } catch (err) {
    if (err instanceof AiError) throw err;

    if (err.status === 401 || err.status === 403) {
      throw new AiError(
        `AI provider rejected the API key (${err.status}). Check AI_API_KEY.`,
        500,
      );
    }
    if (err.status === 429) {
      throw new AiError(
        "AI provider rate limit or quota reached (429). Wait a minute and retry.",
        429,
      );
    }
    if (err.status === 404) {
      throw new AiError(
        `Not found (404): ${err.message}. Check AI_MODEL and AI_BASE_URL in .env.`,
        500,
      );
    }
    if (err.status === 400) {
      throw new AiError(
        `AI provider rejected the request (400): ${err.message}`,
        502,
      );
    }
    throw new AiError(`AI request failed: ${err.message}`);
  }
}

export async function askText({ instructions, input, maxOutputTokens = 2000 }) {
  return complete(
    [
      { role: "system", content: instructions },
      { role: "user", content: input },
    ],
    maxOutputTokens,
  );
}

/**
 * Models sometimes wrap JSON in ```json fences or add a sentence around it.
 * Extract the outermost {...} and parse it.
 */
function parseModelJson(raw) {
  const cleaned = String(raw)
    .replace(/```json|```/gi, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end <= start) {
    throw new AiError("Model did not return JSON.");
  }

  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new AiError("Model returned malformed JSON.");
  }
}

/**
 * Asks the model for JSON and returns the parsed object.
 * Retries only when the JSON itself was bad. API errors (429, 401...) fail immediately.
 */
export async function askJson({
  instructions,
  input,
  maxOutputTokens = 2000,
  attempts = 2,
}) {
  let lastError;

  for (let i = 0; i < attempts; i++) {
    const raw = await askText({ instructions, input, maxOutputTokens });
    try {
      return parseModelJson(raw);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}
/**
 * Sends text plus ONE image and returns the parsed JSON reply.
 * The image is sent inline as a base64 data URL.
 */
export async function askVisionJson({
  instructions,
  text,
  imageBase64,
  mimeType = "image/jpeg",
  maxOutputTokens = 2500,
  attempts = 2,
}) {
  const messages = [
    { role: "system", content: instructions },
    {
      role: "user",
      content: [
        { type: "text", text },
        {
          type: "image_url",
          image_url: { url: `data:${mimeType};base64,${imageBase64}` },
        },
      ],
    },
  ];

  let lastError;
  for (let i = 0; i < attempts; i++) {
    const raw = await complete(messages, maxOutputTokens);
    try {
      return parseModelJson(raw);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
