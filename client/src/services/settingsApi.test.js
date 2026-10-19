import test from "node:test";
import assert from "node:assert/strict";
import { createSettingsApi, createSettingsLoader, mapSettings, settingsPayload, changedSettingsPayload } from "./settingsApi.js";
import { settingsChanged } from "./previewSettings.js";
import { createApi, ApiError } from "./api.js";

const record = { _id: "account-id", name: "Saved Name", email: "saved@example.com", role: "applicant", notificationPreferences: { deadlineReminders: false, mentorFeedback: true } };

test("maps the server profile without retaining extra fields or accepting another account", () => {
  const result = mapSettings({ ...record, tokenVersion: "discard", disabled: false }, record._id);
  assert.deepEqual(result, { id: record._id, name: record.name, email: record.email, role: record.role, notificationPreferences: record.notificationPreferences });
  assert.throws(() => mapSettings(record, "different"), /different account/);
  assert.throws(() => mapSettings({ ...record, role: "invented" }, record._id), /unavailable/);
});

test("GET loads settings and PATCH sends only exact editable fields with both boolean values", async () => {
  const calls = [];
  const service = createSettingsApi({ request: async (...args) => { calls.push(args); return record; } }, record._id);
  await service.load();
  await service.save({ ...record, name: " New name ", email: "changed@example.com", role: "admin", reminderEnabled: true, notificationPreferences: { deadlineReminders: true, mentorFeedback: false, extra: true } });
  assert.equal(calls[0][0], "/settings");
  assert.deepEqual(calls[1], ["/settings", { method: "PATCH", body: { name: "New name", notificationPreferences: { deadlineReminders: true, mentorFeedback: false } } }]);
  assert.ok(calls.every(([path]) => path === "/settings"));
});

test("validation rejects blank name and nonboolean preferences before requesting", async () => {
  let calls = 0;
  const service = createSettingsApi({ request() { calls++; } }, record._id);
  await assert.rejects(service.save({ ...record, name: " " }), /full name/);
  await assert.rejects(service.save({ ...record, notificationPreferences: { deadlineReminders: "true", mentorFeedback: false } }), /true or false/);
  assert.equal(calls, 0);
});

test("draft remains unchanged after failed save; confirmed response becomes clean saved baseline", async () => {
  const original = mapSettings(record, record._id);
  const draft = { ...original, name: "Edited Name", notificationPreferences: { deadlineReminders: true, mentorFeedback: false } };
  const snapshot = structuredClone(draft);
  const failed = createSettingsApi({ request: async () => { throw new ApiError("Name rejected", 400); } }, record._id);
  assert.equal(settingsChanged(draft, original), true);
  await assert.rejects(failed.save(draft), /Name rejected/);
  assert.deepEqual(draft, snapshot);
  assert.equal(settingsChanged(draft, original), true);
  const service = createSettingsApi({ request: async () => ({ ...record, ...settingsPayload(draft), name: "Server Normalized" }) }, record._id);
  const saved = await service.save(draft);
  assert.equal(saved.name, "Server Normalized"); assert.equal(saved.name[0], "S");
  assert.equal(settingsChanged(saved, saved), false);
  assert.equal(saved.email, record.email); assert.equal(saved.role, record.role);
});

test("load failure exposes Retry state without preview fallback; retry loads server settings", async () => {
  let calls = 0;
  const loader = createSettingsLoader(createSettingsApi({ request: async () => {
    if (++calls === 1) throw new ApiError("Network unavailable");
    return record;
  } }, record._id));
  const states = [];
  await loader.load((state) => states.push(state));
  assert.match(states.at(-1).error, /Network unavailable/);
  assert.equal(states.at(-1).settings, undefined);
  await loader.load((state) => states.push(state));
  assert.equal(states.at(-1).settings.id, record._id); assert.equal(calls, 2);
});

test("cancelled and outdated loads never publish earlier settings", async () => {
  const pending = [];
  const loader = createSettingsLoader({ load: (signal) => new Promise((resolve) => pending.push({ resolve, signal })) });
  const states = [];
  const first = loader.load((state) => states.push(state));
  const second = loader.load((state) => states.push(state));
  assert.equal(pending[0].signal.aborted, true);
  pending[1].resolve({ name: "Latest" }); await second;
  pending[0].resolve({ name: "Outdated" }); await first;
  assert.equal(states.at(-1).settings.name, "Latest");
  const third = loader.load((state) => states.push(state)); loader.cancel();
  const count = states.length; pending[2].resolve({ name: "Logged out" }); await third;
  assert.equal(states.length, count);
});

test("401/disabled 403 use shared session handling; stale PATCH response is rejected after logout", async () => {
  for (const status of [401, 403]) {
    let ended = false;
    const api = createApi({ storage: () => ({ getItem: () => "mock", removeItem() {} }), fetcher: async () => new Response(JSON.stringify({ error: status === 401 ? "Session expired" : "This account has been disabled." }), { status }) });
    api.onSessionEnded(() => { ended = true; });
    await assert.rejects(createSettingsApi(api, record._id).load(), { status });
    assert.equal(ended, true);
  }
  let resolve;
  const api = createApi({ storage: () => ({ getItem: () => "mock", removeItem() {} }), fetcher: () => new Promise((done) => { resolve = done; }) });
  const pending = createSettingsApi(api, record._id).save(record);
  api.clear(); resolve(new Response(JSON.stringify(record)));
  await assert.rejects(pending, { status: 499 });
});

 test("mentor settings retain server role and email and update only supported fields", async () => {
   let saved = {...record, role:"mentor"}; const calls=[];
   const service=createSettingsApi({request:async(path, options={})=>{
     calls.push([path,options]);
     if(options.method==="PATCH") saved={...saved,...options.body};
     return saved;
   }},record._id);
   const profile=await service.load(); assert.equal(profile.role,"mentor");
   const updated=await service.save({...profile,name:"Mentor Name",email:"ignore@example.test",role:"admin",notificationPreferences:{deadlineReminders:true,mentorFeedback:false}});
   assert.equal(updated.role,"mentor"); assert.equal(updated.email,record.email);
   assert.equal(updated.name,"Mentor Name");
   assert.deepEqual(Object.keys(calls[1][1].body).sort(),["name","notificationPreferences"]);
 });

test("name-only mentor edits preserve both hidden notification values", async () => {
 for (const deadlineReminders of [true,false]) for (const mentorFeedback of [true,false]) {
   const original={...record,role:"mentor",notificationPreferences:{deadlineReminders,mentorFeedback}};
   let sent;
   const service=createSettingsApi({request:async (_path,options)=>{
     sent=options.body; return {...original,...sent};
   }},original._id);
   const saved=await service.save({...mapSettings(original,original._id),name:"Updated Mentor"});
   assert.deepEqual(sent.notificationPreferences,original.notificationPreferences);
   assert.deepEqual(saved.notificationPreferences,original.notificationPreferences);
   assert.equal(saved.role,"mentor");
 }
});

test("partial settings changes omit hidden preferences, email and role, and trim names", async () => {
 const baseline=mapSettings({...record,role:"mentor"},record._id);
 const draft={...baseline,name:"  Updated Mentor  ",email:"ignored@example.test",role:"admin"};
 assert.deepEqual(changedSettingsPayload(draft,baseline),{name:"Updated Mentor"});
 assert.deepEqual(changedSettingsPayload({...baseline,name:"  "+baseline.name+"  "},baseline),{});
 assert.throws(()=>changedSettingsPayload({...baseline,name:"  "},baseline),/full name/);
 assert.deepEqual(changedSettingsPayload({...baseline,notificationPreferences:{...baseline.notificationPreferences,mentorFeedback:false}},baseline),{notificationPreferences:{mentorFeedback:false}});
 let body;
 const api=createSettingsApi({request:async (_path,options)=>{body=options.body;return {...record,role:"mentor",name:body.name};}},record._id);
 const saved=await api.save(draft,baseline);
 assert.deepEqual(body,{name:"Updated Mentor"});
 assert.deepEqual(saved.notificationPreferences,baseline.notificationPreferences);
 assert.equal(saved.role,"mentor");
});
