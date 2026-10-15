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
    company: { type: String, required: true, trim: true },
    position: { type: String, required: true, trim: true },
    stage: { type: String, enum: STAGES, default: "Applied", required: true },
    deadline: { type: Date, default: null },
    notes: { type: [noteSchema], default: [] },
    reminderEnabled: { type: Boolean, default: true }, // FR-6 deadline reminder toggle
    stageHistory: {
      type: [stageHistoryEntrySchema],
      default: () => [{ stage: "Applied", changedAt: new Date() }],
    },
  },
  { timestamps: true }
);

export default mongoose.models.Application || mongoose.model("Application", applicationSchema);
