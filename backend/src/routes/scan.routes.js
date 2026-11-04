import { Router } from "express";
import { scanWebsite } from "../controllers/scan.controller.js";

const router = Router();

router.post("/scan", scanWebsite);

export default router;
