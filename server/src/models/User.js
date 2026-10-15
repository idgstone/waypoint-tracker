import mongoose from "mongoose";

const { Schema } = mongoose;

export const ROLES = ["applicant", "mentor", "admin"];

/**
 * Shared User schema for all three roles (Applicant / Mentor / Admin).
 * Create users through lib/userFactory.js (Factory Method), not
 * User.create() directly, so role-specific defaults stay in one place.
 */
const userSchema = new Schema(
  {
    name: { type: String, required: [true, "Name is required."], trim: true },
    email: {
      type: String,
      required: [true, "Email is required."],
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, default: "applicant", required: true },
    disabled: { type: Boolean, default: false }, // FR-13 admin disable/re-enable
    notificationPreferences: {
      deadlineReminders: { type: Boolean, default: true },
      mentorFeedback: { type: Boolean, default: true },
    },
    // NFR 5.2 session handling: bumping tokenVersion invalidates every
    // token issued before it (logout); lastActiveAt drives inactivity expiry.
    tokenVersion: { type: Number, default: 0 },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model("User", userSchema);
