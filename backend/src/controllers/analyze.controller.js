import { analyzePageWithAi } from "../ai/page.analysis.js";

// Scans share one screenshot file for now, so only one analysis may run at a time.
const MAX_CONCURRENT = 1;
let running = 0;

class BusyError extends Error {
  constructor() {
    super("Another analysis is already running. Try again in a few seconds.");
    this.name = "BusyError";
    this.statusCode = 503;
  }
}

export async function analyzeWebsiteWithAi(req, res, next) {
  if (running >= MAX_CONCURRENT) {
    return next(new BusyError());
  }

  running++;
  try {
    const { url, include_vision } = req.body ?? {};
    const analysis = await analyzePageWithAi(url, {
      includeVision: include_vision !== false, // only a literal false skips vision
    });

    res.status(200).json({ success: true, analysis });
  } catch (err) {
    next(err);
  } finally {
    running--; // always release the slot, even when the analysis failed
  }
}
