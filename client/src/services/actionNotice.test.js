import test from "node:test";
import assert from "node:assert/strict";
import { scheduleNoticeDismiss } from "./actionNotice.js";

test("success dismisses after four seconds; replacement and unmount cancel old timers", () => {
  const timers = new Map(); let id = 0; let dismissed = 0;
  const schedule = (callback, delay) => { assert.equal(delay, 4000); timers.set(++id, callback); return id; };
  const cancel = (timer) => timers.delete(timer);
  const firstCleanup = scheduleNoticeDismiss({ text: "Saved" }, () => dismissed++, schedule, cancel);
  firstCleanup();
  const nextCleanup = scheduleNoticeDismiss({ text: "Saved" }, () => dismissed++, schedule, cancel);
  assert.equal(timers.size, 1);
  [...timers.values()][0](); assert.equal(dismissed, 1);
  nextCleanup(); assert.equal(timers.size, 0);
});
test("action-required warnings and empty notices have no timer", () => {
  const unexpected = () => assert.fail("must not schedule a dismissal");
  assert.equal(scheduleNoticeDismiss({ text: "Check stage", persistent: true }, unexpected, unexpected), undefined);
  assert.equal(scheduleNoticeDismiss({ text: "" }, unexpected, unexpected), undefined);
});
