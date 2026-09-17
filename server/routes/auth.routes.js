import { Router } from "express";
import {
  signUp,
  signIn,
  signOut,
  getSession,
  forgotPassword,
  resetPassword,
  updateProfile,
  changePassword,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

// Public routes
router.post("/signup", signUp);
router.post("/signin", signIn);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Protected routes (require authentication)
router.post("/signout", requireAuth, signOut);
router.get("/session", requireAuth, getSession);
router.put("/profile", requireAuth, updateProfile);
router.put("/change-password", requireAuth, changePassword);

export default router;