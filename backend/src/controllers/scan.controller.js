import { analyzeWebsite } from "../browser/page.analyzer.js";

export async function scanWebsite(req, res, next) {
  try {
    const { url } = req.body ?? {};
    const analysis = await analyzeWebsite(url);

    res.status(200).json({ success: true, analysis });
  } catch (err) {
    next(err); // hand off to the error handler in app.js
  }
}
