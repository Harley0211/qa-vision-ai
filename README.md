# QA Vision AI

AI-powered website analysis and QA automation platform.

## Status

Phase 1: Foundation complete (website scanner API).

## Stack

Node.js, Express, Playwright. Later phases: React + Vite, Tailwind CSS, SQLite, OpenAI API.

## Getting Started

```bash
cd backend
npm install
npx playwright install chromium
cp .env.example .env    # Windows cmd: copy .env.example .env
npm run dev
```

## API

| Method | Endpoint    | Description                                    |
| ------ | ----------- | ---------------------------------------------- |
| GET    | `/`         | Welcome message                                |
| GET    | `/health`   | Server health                                  |
| POST   | `/api/scan` | Scan a URL: `{ "url": "https://example.com" }` |

The scan returns the page title, final URL, HTTP status, a screenshot path, and extracted
elements (headings, buttons, links, inputs, textareas, selects, forms).

Screenshots are saved to `backend/storage/screenshots/`.

## Safety

- URLs are validated before navigation (http/https only, no credentials).
- Internal hostnames and private/loopback/link-local IPs are blocked, including hostnames
  that resolve to them via DNS.
- Every browser request, including redirects, is re-checked inside Chromium.
- The scanner is read-only: it never clicks, types, or submits anything.

## Known limitations

- DNS is resolved once by our validator and again by Chromium, so a small DNS-rebinding
  window remains. A hardened deployment would use an isolated network or egress proxy.
- Each scan overwrites `latest_scan.png`.
- Scanning private/staging sites requires the authorized local worker planned for a later phase.
