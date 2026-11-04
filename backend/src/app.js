import express from "express";
import cors from "cors";
import scanRoutes from "./routes/scan.routes.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "100kb" }));

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to QA Vision AI API",
    version: "0.1.0",
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

// 404 for unknown routes
app.use((req, res) => {
  res.status(404).json({ success: false, error: "Route not found." });
});

// Central error handler (must have 4 arguments)
app.use((err, req, res, next) => {
  const isValidationError = err.name === "UrlValidationError";
  const statusCode = isValidationError ? err.statusCode : 500;

  if (!isValidationError) {
    console.error("[scan-error]", err);
  }

  res.status(statusCode).json({
    success: false,
    error: isValidationError
      ? err.message
      : "Scan failed. The site may be unreachable, too slow, or blocking automated browsers.",
  });
});

export default app;
