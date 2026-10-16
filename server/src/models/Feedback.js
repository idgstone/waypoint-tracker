import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * FR-10: feedback a Mentor leaves on a specific Applicant's application,
 * visible to the Applicant. Matches the Production Plan's Feedback schema
 * (mentorId, applicationId, comment, timestamp).
 */
const feedbackSchema = new Schema(
  {
    mentorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    applicationId: { type: Schema.Types.ObjectId, ref: "Application", required: true, index: true },
    comment: { type: String, required: true, trim: true },
  },
  { timestamps: true } // createdAt doubles as the timestamp
);

export default mongoose.models.Feedback || mongoose.model("Feedback", feedbackSchema);
