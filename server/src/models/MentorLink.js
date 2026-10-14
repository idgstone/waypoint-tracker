import mongoose from "mongoose";

const { Schema } = mongoose;

const feedbackEntrySchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

/**
 * Links an applicant to a mentor who can view their pipeline (FR-5)
 * and leave feedback (FR-9, FR-10).
 */
const mentorLinkSchema = new Schema(
  {
    applicant: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    mentor: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "revoked"],
      default: "pending",
    },
    feedback: { type: [feedbackEntrySchema], default: [] },
  },
  { timestamps: true }
);

mentorLinkSchema.index({ applicant: 1, mentor: 1 }, { unique: true });

export default mongoose.models.MentorLink || mongoose.model("MentorLink", mentorLinkSchema);
