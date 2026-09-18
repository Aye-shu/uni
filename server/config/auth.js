// server/config/auth.js
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { MongoClient } from "mongodb";

let authInstance = null;
let mongoClient = null;

/* ============================================================
   Lazy Resend client
   - Server boots fine without RESEND_API_KEY
   - Only errors when a reset email is actually requested
============================================================ */
let resendClient = null;
const getResend = async () => {
  if (resendClient) return resendClient;

  if (!process.env.RESEND_API_KEY) {
    throw new Error(
      "RESEND_API_KEY is not set. Add it to your .env file to send reset emails."
    );
  }

  const { Resend } = await import("resend");
  resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
};

export const initAuth = async () => {
  if (authInstance) return authInstance;

  mongoClient = new MongoClient(process.env.MONGODB_URI);
  await mongoClient.connect();
  const db = mongoClient.db("uni");

  const baseURL = process.env.BETTER_AUTH_URL || "http://localhost:5000";

  authInstance = betterAuth({
    database: mongodbAdapter(db),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL,
    basePath: "/api/auth",
    trustedOrigins: [
      baseURL,
      "http://localhost:5000",
      "http://127.0.0.1:5000",
      "https://uni-phi-gold.vercel.app",
      /\.onrender\.com$/,      // Render
      /\.app\.github\.dev$/,   // Codespaces
    ],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 6,

      /* ============================================================
         Reset password email
      ============================================================ */
      sendResetPassword: async ({ user, url, token }) => {
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
                  <a href="${url}"
                     style="background:#f97316;color:#fff;padding:14px 28px;
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
          console.error("❌ Resend error:", JSON.stringify({
            message: err.message,
            error: err.error,
            statusCode: err.statusCode,
            name: err.name,
          }, null, 2));

          // Fallback: print link in terminal so you can still test
          console.log("\n🔗 ===== PASSWORD RESET LINK (fallback) =====");
          console.log(`To:   ${user.email}`);
          console.log(`Link: ${url}`);
          console.log("============================================\n");
        }
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    user: {
      additionalFields: {
        role:          { type: "string", required: false, defaultValue: "student" },
        phone:         { type: "string", required: false },
        studentId:     { type: "string", required: false },
        department:    { type: "string", required: false },
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