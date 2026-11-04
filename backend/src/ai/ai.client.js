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
export async function askText({ instructions, input, maxOutputTokens = 2000 }) {
  try {
    const response = await getClient().chat.completions.create({
      model: getModel(),
      messages: [
        { role: "system", content: instructions },
        { role: "user", content: input },
      ],
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
    throw new AiError(`AI request failed: ${err.message}`);
  }
}
