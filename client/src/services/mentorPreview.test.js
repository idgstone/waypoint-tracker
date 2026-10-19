import test from "node:test";
import assert from "node:assert/strict";
import { mentorStudents, previewMentor } from "../data/mentorFixtures.js";
import { createMentorFeedback, currentStageCounts, loadMentorFeedback, saveMentorFeedback, selectedApplication, selectedStudent, MENTOR_PREVIEW_KEY, parseMentorFeedback } from "./mentorPreview.js";

test("mentor summary uses current stages, combines outcomes, ignores history", () => {
  assert.deepEqual(currentStageCounts(mentorStudents[0].applications), [1, 1, 1, 2]);
  assert.deepEqual(currentStageCounts([{ stage: "Rejected", stageHistory: [{ stage: "Interview" }] }]), [0, 0, 0, 1]);
});
test("empty and invalid selections fall back to available records safely", () => {
  assert.equal(selectedStudent([], "missing"), null);
  assert.equal(selectedStudent(mentorStudents, "missing"), mentorStudents[0]);
  assert.equal(selectedApplication(null, "missing"), null);
  assert.equal(selectedApplication(mentorStudents[2], "missing"), null);
  assert.equal(selectedApplication(mentorStudents[0], "missing"), mentorStudents[0].applications[0]);
});
test("feedback requires a valid student's application and nonblank text; records ownership", () => {
  const student = mentorStudents[0], id = student.applications[0]._id;
  assert.ok(createMentorFeedback(student, id, " \n ").error);
  assert.ok(createMentorFeedback(student, "other-student-app", "Hi").error);
  const { record } = createMentorFeedback(student, id, " Prepare a project example. ");
  assert.equal(record.comment, "Prepare a project example.");
  assert.equal(record.applicationId, id);
  assert.equal(record.mentorId, previewMentor._id);
  assert.equal(record.author, previewMentor.name);
  assert.ok(Number.isFinite(Date.parse(record.createdAt)));
});
test("mentor feedback persists separately; invalid data, failures and production are safe", () => {
  const store = new Map();
  const storage = () => ({ getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) });
  const { record } = createMentorFeedback(mentorStudents[0], mentorStudents[0].applications[0]._id, "Sample comment");
  assert.equal(saveMentorFeedback([record], true, storage), "");
  assert.deepEqual(loadMentorFeedback(true, storage).feedback, [record]);
  assert.deepEqual([...store.keys()], [MENTOR_PREVIEW_KEY]);
  assert.throws(() => parseMentorFeedback(JSON.stringify([{ ...record, mentorId: "other" }])));
  assert.throws(() => parseMentorFeedback(JSON.stringify([record, record])));
  store.set(MENTOR_PREVIEW_KEY, "null"); assert.ok(loadMentorFeedback(true, storage).error);
  const blocked = () => { throw new Error("blocked"); };
  assert.ok(saveMentorFeedback([record], true, blocked));
  assert.equal(loadMentorFeedback(false, blocked).error, "");
  assert.ok(saveMentorFeedback([record], false, blocked));
});
