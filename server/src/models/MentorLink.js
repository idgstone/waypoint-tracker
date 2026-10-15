import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * Links an applicant to a mentor (FR-8 invite, FR-9 accept + read-only
 * pipeline view). Per-application feedback is its own Feedback model
 * (FR-10), not stored here.
 */
const mentorLinkSchema = new Schema(
  {
    applicant: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    mentor: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    mentorEmail: { type: String, required: true, trim: true, lowercase: true }, // email the invite was sent to
    status: {
      type: String,
      enum: ["pending", "accepted", "revoked"],
      default: "pending",
    },
  },
  { timestamps: true }
);

mentorLinkSchema.index({ applicant: 1, mentor: 1 }, { unique: true });

export default mongoose.models.MentorLink || mongoose.model("MentorLink", mentorLinkSchema);
