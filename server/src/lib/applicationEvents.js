import { EventEmitter } from "node:events";

/**
 * Observer pattern (per the Design Patterns UML doc): a single event bus
 * that application-stage changes publish to. Observers subscribe
 * independently, so routes/applications.js never calls them directly and
 * new observers (e.g. a notification center) can be added without
 * touching the route.
 */
export const applicationEvents = new EventEmitter();

export const STAGE_CHANGED = "application:stageChanged";

// --- Observers ---

// FR-7 analytics: the dashboard recomputes from stageHistory on request
// (routes/analytics.js), so this observer only records the transition.
applicationEvents.on(STAGE_CHANGED, ({ application, previousStage, newStage }) => {
  console.log(`[analytics] ${application.owner}: "${application.company}" ${previousStage} -> ${newStage}`);
});

// FR-6 reminders / UC-2 alternate flow: once a pipeline closes (Offer or
// Rejected) the application stops getting deadline reminders. The hourly
// job (lib/reminderJob.js) already skips closed stages; this observer
// makes the change visible in the logs at the moment it happens.
applicationEvents.on(STAGE_CHANGED, ({ application, newStage }) => {
  if (newStage === "Offer" || newStage === "Rejected") {
    console.log(`[reminders] "${application.company}" closed (${newStage}); no further reminders.`);
  }
});
