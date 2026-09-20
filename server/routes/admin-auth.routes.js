// server/routes/admin-auth.routes.js
import express from "express";
import { MongoClient } from "mongodb";
import { getAuth } from "../config/auth.js";

const router = express.Router();

router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, employeeId, phone, inviteCode } = req.body;

    if (!name || !email || !password || !inviteCode) {
      return res.status(400).json({
        success: false,
        message: "Name, email, password, and invite code are required",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    const expectedCode = process.env.ADMIN_INVITE_CODE;
    if (!expectedCode) {
      return res.status(500).json({
        success: false,
        message: "Admin signup is not configured (missing ADMIN_INVITE_CODE)",
      });
    }
    if (inviteCode.trim() !== expectedCode) {
      return res.status(403).json({
        success: false,
        message: "Invalid invite code",
      });
    }

    // Create user via Better Auth (defaults to student)
    const auth = getAuth();
    const result = await auth.api.signUpEmail({
      body: { name, email, password },
    });

    if (!result?.user?.id) {
      return res.status(500).json({
        success: false,
        message: "Signup failed",
      });
    }

    // Promote to admin in the DB
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db("uni");

    await db.collection("user").updateOne(
      { _id: result.user.id },
      {
        $set: {
          role: "admin",
          employeeId: employeeId || null,
          phone: phone || null,
          updatedAt: new Date(),
        },
      }
    );

    await client.close();

    return res.status(201).json({
      success: true,
      message: "Admin account created",
      data: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: "admin",
      },
    });
  } catch (err) {
    console.error("admin-signup error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Admin signup failed",
    });
  }
});

export default router;