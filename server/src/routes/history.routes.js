import express from "express";
import { 
  saveFloorPlan, 
  getUserFloorPlans, 
  getFloorPlanById, 
  deleteFloorPlan 
} from "../controllers/history.controller.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/save", protect, saveFloorPlan);
router.get("/", protect, getUserFloorPlans);
router.get("/:id", protect, getFloorPlanById);
router.delete("/:id", protect, deleteFloorPlan);

export default router;
