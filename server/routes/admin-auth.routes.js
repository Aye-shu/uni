// server/routes/admin-auth.routes.js
import express from "express";
import { MongoClient } from "mongodb";
import { getAuth } from "../config/auth.js";

const router = express.Router();

router.post("/signup", async (req, res) => {
  let client;
  try {
    const { name, email, password, employeeId, phone, inviteCode } = req.body;

    // 1. Validate
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

    const lowerEmail = email.toLowerCase().trim();

    // 2. Check for existing user
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db("uni");

    const existing = await db.collection("user").findOne({ email: lowerEmail });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "A user with this email already exists",
      });
    }

    // 3. Create user via Better Auth
    const auth = getAuth();
    const result = await auth.api.signUpEmail({
      body: { name, email: lowerEmail, password },
    });

    const userId = result?.user?.id || result?.user?._id || null;
    console.log("👤 Better Auth created user:", userId);

    if (!userId) {
      return res.status(500).json({
        success: false,
        message: "Better Auth returned no user id",
      });
    }

    // 4. Promote to admin — try by _id first, fall back to email
    let updateResult = await db.collection("user").updateOne(
      { _id: userId },
      {
        $set: {
          role: "admin",
          employeeId: employeeId || null,
          phone: phone || null,
          updatedAt: new Date(),
        },
      }
    );

    console.log("📝 Update by _id:", {
      matched: updateResult.matchedCount,
      modified: updateResult.modifiedCount,
    });

    // Fallback: match by email if the id lookup missed
    if (updateResult.matchedCount === 0) {
      updateResult = await db.collection("user").updateOne(
        { email: lowerEmail },
        {
          $set: {
            role: "admin",
            employeeId: employeeId || null,
            phone: phone || null,
            updatedAt: new Date(),
          },
        }
      );
      console.log("📝 Update by email:", {
        matched: updateResult.matchedCount,
        modified: updateResult.modifiedCount,
      });
    }

    // 5. Verify the role actually saved
    const finalUser = await db.collection("user").findOne({ email: lowerEmail });
    console.log("✅ Final DB role:", finalUser?.role);

    if (finalUser?.role !== "admin") {
      return res.status(500).json({
        success: false,
        message: "Failed to promote user to admin — role is still: " + finalUser?.role,
      });
    }

    // 6. Delete any auto-created session so the user must log in fresh
    //    (This prevents the "logged in as student" issue.)
    await db.collection("session").deleteMany({ userId: String(userId) });

    return res.status(201).json({
      success: true,
      message: "Admin account created. Please log in.",
      data: {
        id: userId,
        email: lowerEmail,
        name,
        role: "admin",
      },
    });
  } catch (err) {
    console.error("❌ admin-signup error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Admin signup failed",
    });
  } finally {
    if (client) await client.close();
  }
});

export default router;
