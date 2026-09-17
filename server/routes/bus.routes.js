// server/routes/bus.routes.js
import express from "express";
import { requireAuth, authorize } from "../middleware/auth.middleware.js";
import {
  getAllBuses,
  getLiveBuses,
  getBusById,
  createBus,
  updateBus,
  deleteBus,
} from "../controllers/bus.controller.js";

const router = express.Router();

// Public read
router.get("/", getAllBuses);
router.get("/live", getLiveBuses);
router.get("/:id", getBusById);

// Admin only
router.post("/", requireAuth, authorize("admin"), createBus);
router.put("/:id", requireAuth, authorize("admin"), updateBus);
router.delete("/:id", requireAuth, authorize("admin"), deleteBus);

export default router;