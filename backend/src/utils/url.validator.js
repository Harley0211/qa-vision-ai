import { lookup } from "node:dns/promises";
import net from "node:net";

const ALLOWED_PROTOCOLS = ["http:", "https:"];

const BLOCKED_HOSTNAMES = ["localhost", "metadata.google.internal"];
const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal"];

/**
 * Custom error so callers can tell "bad input" apart from real crashes.
 */
export class UrlValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "UrlValidationError";
    this.statusCode = 400;
  }
}

/**
 * Returns true if an IPv4 address is private, loopback, link-local, etc.
 */
function isPrivateIPv4(ip) {
  const [a, b] = ip.split(".").map(Number);

  return (
    a === 0 || // "this" network
    a === 10 || // private
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local (cloud metadata lives here)
    (a === 172 && b >= 16 && b <= 31) || // private
    (a === 192 && b === 168) || // private
    (a === 192 && b === 0) || // reserved
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    a >= 224 // multicast and reserved
  );
}

/**
 * Returns true if an IPv6 address is loopback, private, or link-local.
 */
function isPrivateIPv6(ip) {
  const lower = ip.toLowerCase();

  // IPv4-mapped addresses like ::ffff:127.0.0.1 -> check the IPv4 part
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);

  return (
    lower === "::1" || // loopback
    lower === "::" || // unspecified
    lower.startsWith("fc") || // unique local (fc00::/7)
    lower.startsWith("fd") ||
    lower.startsWith("fe8") || // link-local (fe80::/10)
    lower.startsWith("fe9") ||
    lower.startsWith("fea") ||
    lower.startsWith("feb")
  );
}

function isPrivateIp(ip) {
  const version = net.isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return false;
}

/**
 * Validates a URL before we let the browser navigate to it.
 * Returns the normalized URL string if safe; throws UrlValidationError otherwise.
 */
export async function validateUrl(input) {
  // 1. Basic input check
  if (typeof input !== "string" || input.trim() === "") {
    throw new UrlValidationError(
      "URL is required and must be a non-empty string.",
    );
  }

  // 2. Parse
  let parsed;
  try {
    parsed = new URL(input.trim());
  } catch {
    throw new UrlValidationError(
      "Invalid URL format. Include the protocol, e.g. https://example.com",
    );
  }

  // 3. Protocol allow-list
  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    throw new UrlValidationError(
      `Protocol "${parsed.protocol}" is not allowed. Use http or https.`,
    );
  }

  // 4. No embedded credentials
  if (parsed.username || parsed.password) {
    throw new UrlValidationError(
      "URLs containing credentials are not allowed.",
    );
  }

  // 5. Hostname checks. Node wraps IPv6 in [brackets], so strip them.
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();

  if (
    BLOCKED_HOSTNAMES.includes(hostname) ||
    BLOCKED_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    throw new UrlValidationError(
      "Access to internal hostnames is not allowed.",
    );
  }

  // 6. If the host is already an IP, check it directly
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new UrlValidationError(
        "Access to private or internal IP addresses is not allowed.",
      );
    }
    return parsed.href;
  }

  // 7. Otherwise resolve DNS and check EVERY returned IP
  let addresses;
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new UrlValidationError(`Could not resolve hostname "${hostname}".`);
  }

  if (addresses.some(({ address }) => isPrivateIp(address))) {
    throw new UrlValidationError(
      "This hostname resolves to a private or internal IP address, which is not allowed.",
    );
  }

  return parsed.href;
}
