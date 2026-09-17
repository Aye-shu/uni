// server/routes/class.routes.js
import express from "express";
import { requireAuth, authorize } from "../middleware/auth.middleware.js";
import {
  getMyClasses,
  getClassesByDay,
  getClassById,
  createClass,
  updateClass,
  deleteClass,
} from "../controllers/class.controller.js";

const router = express.Router();

// ---------- Student-specific ----------
router.get("/", requireAuth, authorize("student"), getMyClasses);
router.get("/day/:day", requireAuth, authorize("student"), getClassesByDay);

// ---------- Single class (any authenticated user) ----------
router.get("/:id", requireAuth, getClassById);

// ---------- CRUD (student only) ----------
router.post("/", requireAuth, authorize("student"), createClass);
router.put("/:id", requireAuth, authorize("student"), updateClass);
router.delete("/:id", requireAuth, authorize("student"), deleteClass);

export default router;