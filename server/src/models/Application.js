import mongoose from "mongoose";

const { Schema } = mongoose;

export const STAGES = ["Applied", "Online Assessment", "Interview", "Offer", "Rejected"];

const stageHistoryEntrySchema = new Schema(
  {
    stage: { type: String, enum: STAGES, required: true },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// FR-5: free-text notes, each independently addable/editable/deletable.
const noteSchema = new Schema(
  {
    text: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

const applicationSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    company: { type: String, required: [true, "Company name is required."], trim: true },
    position: { type: String, required: [true, "Role title is required."], trim: true },
    link: { type: String, trim: true, default: "" }, // UC-1: optional application link
    dateApplied: { type: Date, default: Date.now }, // FR-3
    stage: { type: String, enum: STAGES, default: "Applied", required: true },
    deadline: { type: Date, default: null }, // FR-6
    reminderEnabled: { type: Boolean, default: true }, // FR-6 per-application opt-in
    // FR-6: the deadline a reminder was already sent for, so the hourly job
    // sends once per deadline (and again only if the deadline changes).
    reminderSentFor: { type: Date, default: null },
    notes: { type: [noteSchema], default: [] },
    stageHistory: {
      type: [stageHistoryEntrySchema],
      default: () => [{ stage: "Applied", changedAt: new Date() }],
    },
  },
  { timestamps: true }
);

export default mongoose.models.Application || mongoose.model("Application", applicationSchema);
