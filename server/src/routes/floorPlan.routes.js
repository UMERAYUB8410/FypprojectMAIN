import express from "express";
import { generate2D, generateFloorPlans } from "../controllers/floorPlan.controller.js";

const router = express.Router();

router.post("/generate-2d", generate2D);
router.post("/generate", generateFloorPlans);

export default router;
