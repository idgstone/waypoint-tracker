import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * Shared User schema (Applicant / Mentor / Admin).
 * Auth fields (passwordHash, etc.) and the Factory Method for
 * role-based account creation are owned by Michael (auth endpoints) —
 * this file defines the shape other modules (Application, MentorLink)
 * need to reference via ObjectId. Coordinate before changing field names.
 */
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["applicant", "mentor", "admin"],
      default: "applicant",
      required: true,
    },
    disabled: { type: Boolean, default: false }, // used by FR-13 admin disable/re-enable
    notificationPreferences: {
      deadlineReminders: { type: Boolean, default: true },
      mentorFeedback: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model("User", userSchema);
