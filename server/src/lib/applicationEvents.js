import { EventEmitter } from "node:events";

/**
 * Observer pattern (per Design Patterns UML doc): a single event bus that
 * application-stage changes publish to. Analytics recompute and deadline
 * reminders subscribe as independent observers, so neither has to be
 * called directly from the stage-change route — new observers (e.g. a
 * notification-center widget) can subscribe later without touching
 * routes/applications.js.
 */
export const applicationEvents = new EventEmitter();

export const STAGE_CHANGED = "application:stageChanged";

// --- Observers ---

// FR-7: Analytics dashboard. Stub for now — Sprint Two will replace this
// with a real aggregation (e.g. recompute a cached funnel count per user).
applicationEvents.on(STAGE_CHANGED, ({ application, previousStage, newStage }) => {
  console.log(
    `[analytics] ${application.owner}: "${application.company}" ${previousStage} -> ${newStage}`
  );
});

// FR-6: Deadline reminders. Stub for now — Sprint Two will wire this to
// the transactional email service (EMAIL_SERVICE_API_KEY) and only act
// when the application still has reminderEnabled=true and an open deadline.
applicationEvents.on(STAGE_CHANGED, ({ application, newStage }) => {
  if (newStage === "Offer" || newStage === "Rejected") {
    console.log(`[reminders] clearing deadline reminder for "${application.company}" (pipeline closed)`);
  }
});
