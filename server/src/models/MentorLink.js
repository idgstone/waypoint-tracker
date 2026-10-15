import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * Links an applicant to a mentor (FR-8 invite, FR-9 accept + read-only
 * pipeline view). Per-application feedback is its own Feedback model
 * (FR-10), not stored here.
 *
 * `mentor` is null while the invited email has no Mentor account yet
 * (UC-4: the mentor "creates or logs into a Mentor account" after the
 * invite). Registration as a mentor fills it in.
 */
const mentorLinkSchema = new Schema(
  {
    applicant: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    mentor: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    mentorEmail: { type: String, required: true, trim: true, lowercase: true, index: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "revoked"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// One link per applicant/email pair; re-inviting reuses it.
mentorLinkSchema.index({ applicant: 1, mentorEmail: 1 }, { unique: true });

export default mongoose.models.MentorLink || mongoose.model("MentorLink", mentorLinkSchema);
