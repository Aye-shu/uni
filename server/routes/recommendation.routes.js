// server/routes/recommendation.routes.js
import express from "express";
import { requireAuth, authorize } from "../middleware/auth.middleware.js";
import {
  getRecommendations,
  recommendFromClass,
} from "../controllers/recommendation.controller.js";

const router = express.Router();

// Both endpoints are student-only
router.post("/find", requireAuth, authorize("student"), getRecommendations);
router.post("/from-class", requireAuth, authorize("student"), recommendFromClass);

export default router;