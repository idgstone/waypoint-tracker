// Refresh fields that are still pristine without overwriting the user's edits.
export function refreshedDraftValue(draft, previousSaved, nextSaved) {
  return draft === previousSaved ? nextSaved : draft;
}

export function rebaseSettingsDraft(draft, previousSaved, nextSaved) {
  return {
    ...nextSaved,
    name: refreshedDraftValue(draft.name, previousSaved.name, nextSaved.name),
    notificationPreferences: {
      deadlineReminders: refreshedDraftValue(draft.notificationPreferences.deadlineReminders, previousSaved.notificationPreferences.deadlineReminders, nextSaved.notificationPreferences.deadlineReminders),
      mentorFeedback: refreshedDraftValue(draft.notificationPreferences.mentorFeedback, previousSaved.notificationPreferences.mentorFeedback, nextSaved.notificationPreferences.mentorFeedback),
    },
  };
}
