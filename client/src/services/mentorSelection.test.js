import test from "node:test";
import assert from "node:assert/strict";
import { linkedStudent } from "./mentorSelection.js";
test("mentor view uses only the explicitly selected accepted student, without first-student fallback", () => {
 const student={_id:"student",name:"Student"}; const links=[{status:"accepted",applicant:student}];
 assert.equal(linkedStudent(links,"student"),student);
 assert.equal(linkedStudent(links,""),null);
 assert.equal(linkedStudent(links,"other"),null);
 assert.equal(linkedStudent(null,"student"),null);
 assert.equal(linkedStudent([{status:"revoked",applicant:student}],"student"),null);
 assert.equal(linkedStudent([{status:"pending",applicant:student}],"student"),null);
 assert.equal(linkedStudent([{status:"accepted",applicant:null}],"student"),null);
});
