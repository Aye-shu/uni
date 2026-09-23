// server/config/auth.js
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { MongoClient } from "mongodb";

let authInstance = null;
let mongoClient = null;

export const initAuth = async () => {
  if (authInstance) return authInstance;

  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set.");
  if (!process.env.BETTER_AUTH_SECRET) throw new Error("BETTER_AUTH_SECRET is not set.");

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
      "https://uni-e7l7.onrender.com",
      /\.onrender\.com$/,
      /\.app\.github\.dev$/,
    ],

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 6,

      // THIS is what registers POST /api/auth/forget-password
      sendResetPassword: async ({ user, url, token }) => {
        // Always log the link — this is your guaranteed fallback
        console.log("\n🔗 ===== PASSWORD RESET LINK =====");
        console.log(`To:   ${user.email}`);
        console.log(`Link: ${url}`);
        console.log("==================================\n");

        // Try to email — but never let failures bubble up
        try {
          if (!process.env.RESEND_API_KEY) {
            console.warn("⚠️ RESEND_API_KEY not set — link logged above");
            return;
          }

          const { Resend } = await import("resend");
          const resend = new Resend(process.env.RESEND_API_KEY);

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
          console.warn("⚠️ Email failed (link above is still valid):", err.message);
        }
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },

    user: {
      additionalFields: {
        role:          { type: "string", required: false, defaultValue: "student", input: false },
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
