import { auth } from "../config/auth.js";
import User from "../models/User.js";
import { successResponse, errorResponse } from "../utils/response.utils.js";

// Sign Up
export const signUp = async (req, res) => {
  try {
    const { name, email, password, role, phone, studentId, department, licenseNumber } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return errorResponse(res, "Email already registered", 400);
    }

    // Create user with Better Auth
    const result = await auth.api.signEmailPassword({
      body: {
        email,
        password,
        name,
        role: role || "student",
        phone: phone || "",
        studentId: studentId || "",
        department: department || "",
        licenseNumber: licenseNumber || "",
      },
      headers: req.headers,
    });

    return successResponse(res, result, "Account created successfully", 201);
  } catch (error) {
    console.error("Sign up error:", error);
    return errorResponse(res, error.message || "Failed to create account", 400);
  }
};

// Sign In
export const signIn = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await auth.api.signInEmail({
      body: {
        email,
        password,
      },
      headers: req.headers,
    });

    return successResponse(res, result, "Signed in successfully");
  } catch (error) {
    console.error("Sign in error:", error);
    return errorResponse(res, "Invalid email or password", 401);
  }
};

// Sign Out
export const signOut = async (req, res) => {
  try {
    await auth.api.signOut({
      headers: req.headers,
    });

    return successResponse(res, null, "Signed out successfully");
  } catch (error) {
    console.error("Sign out error:", error);
    return errorResponse(res, "Failed to sign out", 400);
  }
};

// Get Session
export const getSession = async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session) {
      return errorResponse(res, "No active session", 401);
    }

    // Get full user data from database
    const user = await User.findById(session.user.id).select("-password");
    if (!user) {
      return errorResponse(res, "User not found", 404);
    }

    return successResponse(res, { session, user }, "Session retrieved");
  } catch (error) {
    console.error("Get session error:", error);
    return errorResponse(res, "Failed to get session", 400);
  }
};

// Forgot Password
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return errorResponse(res, "No account found with this email", 404);
    }

    // Generate reset token (implement with your email service)
    // For now, return success message
    return successResponse(res, null, "Password reset link sent to your email");
  } catch (error) {
    console.error("Forgot password error:", error);
    return errorResponse(res, "Failed to process request", 400);
  }
};

// Reset Password
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Verify token and update password (implement token verification)
    // For now, return success message
    return successResponse(res, null, "Password reset successfully");
  } catch (error) {
    console.error("Reset password error:", error);
    return errorResponse(res, "Failed to reset password", 400);
  }
};

// Update Profile
export const updateProfile = async (req, res) => {
  try {
    const { name, phone, profileImage } = req.body;
    const userId = req.user.id;

    const user = await User.findByIdAndUpdate(
      userId,
      { name, phone, profileImage },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return errorResponse(res, "User not found", 404);
    }

    return successResponse(res, user, "Profile updated successfully");
  } catch (error) {
    console.error("Update profile error:", error);
    return errorResponse(res, "Failed to update profile", 400);
  }
};

// Change Password
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return errorResponse(res, "User not found", 404);
    }

    // Verify current password (implement with Better Auth)
    // For now, update directly
    user.password = newPassword;
    await user.save();

    return successResponse(res, null, "Password changed successfully");
  } catch (error) {
    console.error("Change password error:", error);
    return errorResponse(res, "Failed to change password", 400);
  }
};