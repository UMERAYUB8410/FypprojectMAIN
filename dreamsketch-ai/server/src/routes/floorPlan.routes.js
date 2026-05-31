import express from "express";
import { generate2D } from "../controllers/floorPlan.controller.js";

const router = express.Router();

router.post("/generate-2d", generate2D);

export default router;
