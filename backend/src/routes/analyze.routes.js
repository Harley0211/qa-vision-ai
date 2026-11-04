import { Router } from "express";
import { analyzeWebsiteWithAi } from "../controllers/analyze.controller.js";

const router = Router();

router.post("/analyze", analyzeWebsiteWithAi);

export default router;
