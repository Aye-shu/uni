// server/config/auth.js
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { MongoClient } from "mongodb";

let authInstance = null;
let mongoClient = null;

// ============================================================
// Lazy Resend client
// ============================================================
let resendClient = null;
const getResend = async () => {
  if (resendClient) return resendClient;
  if (!process.env.RESEND_API_KEY) {
    throw new Error(
      "RESEND_API_KEY is not set. Add it to your environment variables to send reset emails."
    );
  }
  const { Resend } = await import("resend");
  resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
};

// ============================================================
// Initialize Better Auth
// ============================================================
export const initAuth = async () => {
  if (authInstance) return authInstance;

  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set.");
  if (!process.env.BETTER_AUTH_SECRET) throw new Error("BETTER_AUTH_SECRET is not set.");

  mongoClient = new MongoClient(process.env.MONGODB_URI);
  await mongoClient.connect();

  // IMPORTANT: use the same database as the rest of UniBus
  const db = mongoClient.db("uni");

  const baseURL = process.env.BETTER_AUTH_URL || "http://localhost:5000";

  authInstance = betterAuth({
    // ----- Database -----
    database: mongodbAdapter(db),

    // ----- Security -----
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL,
    basePath: "/api/auth",
    trustedOrigins: [
      baseURL,
      "http://localhost:5000",
      "http://127.0.0.1:5000",
      "https://uni-e7l7.onrender.com",
      "https://uni-a-c261.vercel.app",
      "https://uni-phi-gold.vercel.app",
    ],

    // ----- Email + Password -----
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 6,

      sendResetPassword: async ({ user, url }) => {
        try {
          const resend = await getResend();
          await resend.emails.send({
            from: "UniBus <onboarding@resend.dev>",
            to: user.email,
            subject: "Reset your UniBus password",
            html: `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
                <h1 style="color:#0f0f0f;font-size:22px;">Reset Your Password</h1>
                <p style="color:#444;line-height:1.6;">
                  Hi ${user.name || "there"}, we received a request to reset your UniBus password.
                </p>
                <p style="text-align:center;margin:32px 0;">
                  <a href="${url}" style="background:#f97316;color:#fff;padding:14px 28px;
                     border-radius:10px;text-decoration:none;font-weight:700;">
                    Reset Password
                  </a>
                </p>
                <p style="color:#6b7280;font-size:14px;">
                  Or copy this link:<br>
                  <a href="${url}" style="color:#f97316;word-break:break-all;">${url}</a>
                </p>
                <p style="color:#9ca3af;font-size:13px;">
                  This link expires in 1 hour. If you didn't request this, ignore this email.
                </p>
              </div>
            `,
          });
          console.log(`✅ Reset email sent to ${user.email}`);
        } catch (err) {
          console.error("❌ Resend error:", {
            message: err.message,
            error: err.error,
            statusCode: err.statusCode,
            name: err.name,
          });
          // Fallback for development/testing
          console.log("\n🔗 ===== PASSWORD RESET LINK (fallback) =====");
          console.log(`To:   ${user.email}`);
          console.log(`Link: ${url}`);
          console.log("============================================\n");
        }
      },
    },

    // ----- Session -----
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },

    advanced: {
      ipAddress: {
        trustedProxies: ["0.0.0.0/0"],
      },
    },

    // ----- Additional User Fields -----
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: false,
          defaultValue: "student",
          input: false,
        },
        phone: { type: "string", required: false },
        studentId: { type: "string", required: false },
        department: { type: "string", required: false },
        licenseNumber: { type: "string", required: false },
      },
    },
  });

  console.log(`🔐 Better Auth initialized (baseURL: ${baseURL})`);
  return authInstance;
};

export const getAuth = () => {
  if (!authInstance) throw new Error("Auth not initialized. Call initAuth() first.");
  return authInstance;
};

export default { initAuth, getAuth };