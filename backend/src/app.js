import express from "express";
import cors from "cors";
import scanRoutes from "./routes/scan.routes.js";
import analyzeRoutes from "./routes/analyze.routes.js";

const app = express();

// Only the local frontend (Vite's default address) may call this API from a browser.
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "100kb" }));

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to QA Vision AI API",
    version: "0.2.0",
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime_seconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.use("/api", scanRoutes);
app.use("/api", analyzeRoutes);

// 404 for unknown routes
app.use((req, res) => {
  res.status(404).json({ success: false, error: "Route not found." });
});

// Errors whose messages we wrote ourselves, so they are safe to show the client.
const SAFE_ERRORS = ["UrlValidationError", "AiError", "BusyError"];

// Central error handler (must have 4 arguments)
app.use((err, req, res, next) => {
  // Malformed JSON body, e.g. bad quoting in curl
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      error: "Request body is not valid JSON.",
    });
  }

  const isSafe = SAFE_ERRORS.includes(err.name);
  const statusCode = isSafe ? err.statusCode : 500;

  if (!isSafe) {
    console.error("[scan-error]", err);
  } else if (err.name === "AiError") {
    console.warn("[ai-error]", err.message);
  }

  res.status(statusCode).json({
    success: false,
    error: isSafe
      ? err.message
      : "Scan failed. The site may be unreachable, too slow, or blocking automated browsers.",
  });
});

export default app;
