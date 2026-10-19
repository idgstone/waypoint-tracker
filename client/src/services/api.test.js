import test from "node:test";
import assert from "node:assert/strict";
import { createApi, validateAuth } from "./api.js";

const user = { id: "test-user", name: "Test User", email: "test@example.com", role: "applicant" };
const values = { ...user, password: "Example123" };
function setup(responses, initial = null) {
  const saved = new Map(initial ? [["waypoint.auth.token.v1", initial]] : []);
  const calls = [];
  const api = createApi({ storage: () => ({ getItem: (key) => saved.get(key), setItem: (key, value) => saved.set(key, value), removeItem: (key) => saved.delete(key) }), fetcher: async (...args) => {
    calls.push(args);
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return new Response(next.status === 204 ? null : JSON.stringify(next.body), { status: next.status });
  } });
  return { api, calls, saved };
}

test("register and login send only documented fields; session stores only token", async () => {
  for (const role of ["applicant", "mentor", "admin"]) {
    const { api, calls, saved } = setup([{ status: 201, body: { token: "mock-token", user: { ...user, role } } }]);
    const mode = role === "admin" ? "login" : "signup";
    assert.equal((await api.authenticate(mode, { ...values, role })).role, role);
    assert.equal(calls[0][0], mode === "signup" ? "/api/auth/register" : "/api/auth/login");
    const body = JSON.parse(calls[0][1].body);
    assert.deepEqual(Object.keys(body).sort(), mode === "signup" ? ["email", "name", "password", "role"] : ["email", "password"]);
    assert.equal(calls[0][1].headers.Authorization, undefined);
    assert.equal(calls[0][1].cache, "no-store");
    assert.deepEqual([...saved.values()], ["mock-token"]);
  }
});

test("restored token is Bearer-authenticated; logout accepts 204 and clears storage", async () => {
  const { api, calls, saved } = setup([{ status: 200, body: user }, { status: 204 }], "mock-token");
  assert.deepEqual(await api.me(), user);
  await api.logout();
  assert.deepEqual(calls.map(([path]) => path), ["/api/auth/me", "/api/auth/logout"]);
  for (const [, options] of calls) assert.equal(options.headers.Authorization, "Bearer mock-token");
  for (const [, options] of calls) assert.equal(options.cache, "no-store");
  assert.equal(saved.size, 0);
  assert.equal(api.hasToken(), false);
});

test("protected 401 and disabled 403 end session; unrelated 403 does not", async () => {
  for (const [status, message, ends] of [[401, "Session expired", true], [403, "This account has been disabled.", true], [403, "Wrong role", false]]) {
    const { api } = setup([{ status, body: { error: message } }], "mock-token");
    let ended = "";
    api.onSessionEnded((message) => { ended = message; });
    await assert.rejects(api.me(), { message, status });
    assert.equal(Boolean(ended), ends);
    assert.equal(api.hasToken(), !ends);
  }
});

test("wrong credentials, duplicate registration, and disabled login show server error without session", async () => {
  for (const status of [400, 401, 403, 409, 500]) {
    const { api } = setup([{ status, body: { error: "Documented server error" } }]);
    await assert.rejects(api.authenticate("login", values), { message: "Documented server error", status });
    assert.equal(api.hasToken(), false);
  }
});

test("network failure preserves token for retry, including failed logout", async () => {
  const { api } = setup([new Error("network"), new Error("network")], "mock-token");
  await assert.rejects(api.me(), /Cannot reach Waypoint/);
  await assert.rejects(api.logout(), /Cannot reach Waypoint/);
  assert.equal(api.hasToken(), true);
});

test("unavailable browser storage falls back to memory with a warning", async () => {
  const api = createApi({ storage() { throw new Error("blocked"); }, fetcher: async () => new Response(JSON.stringify({ token: "mock-token", user })) });
  await api.authenticate("login", values);
  assert.equal(api.hasToken(), true);
  assert.match(api.storageWarning(), /will not survive a refresh/);
});

test("invalid session response cannot establish authentication", async () => {
  const { api } = setup([{ status: 200, body: { token: "mock-token", user: { ...user, role: "unknown" } } }]);
  await assert.rejects(api.authenticate("login", values), /invalid session/);
  assert.equal(api.hasToken(), false);
});

test("validation matches backend registration strength and roles without imposing strength on login", () => {
  assert.deepEqual(validateAuth("signup", values), {});
  for (const password of ["short1", "abcdefgh", "12345678"]) assert.ok(validateAuth("signup", { ...values, password }).password);
  assert.equal(validateAuth("login", { ...values, password: "old" }).password, undefined);
  assert.ok(validateAuth("signup", { ...values, role: "admin" }).role);
  assert.ok(validateAuth("signup", { ...values, name: " ", email: "invalid" }).name);
  assert.ok(validateAuth("signup", { ...values, email: "invalid" }).email);
});

test("older login responses cannot overwrite a newer authenticated account", async () => {
  const pending = []; const stored = new Map();
  const api = createApi({ storage: () => ({ getItem: (key) => stored.get(key), setItem: (key, value) => stored.set(key, value), removeItem: (key) => stored.delete(key) }), fetcher: () => new Promise((resolve) => pending.push(resolve)) });
  const first = api.authenticate("login", values);
  const second = api.authenticate("login", { ...values, email: "other@example.com" });
  pending[1](new Response(JSON.stringify({ token: "new-mock-token", user: { ...user, id: "new-user" } })));
  assert.equal((await second).id, "new-user");
  pending[0](new Response(JSON.stringify({ token: "old-mock-token", user })));
  await assert.rejects(first, { status: 499 });
  assert.deepEqual([...stored.values()], ["new-mock-token"]);
});

test("leaving an auth form or clearing a session invalidates its pending sign-in response", async () => {
  for (const cancel of ["cancelAuthentication", "clear"]) {
    let resolve;
    const api = createApi({ storage: () => ({ getItem: () => null, setItem() { throw new Error("must not store an abandoned token"); }, removeItem() {} }), fetcher: () => new Promise((done) => { resolve = done; }) });
    const pending = api.authenticate("login", values);
    api[cancel](); resolve(new Response(JSON.stringify({ token: "abandoned-mock", user })));
    await assert.rejects(pending, { status: 499 });
    assert.equal(api.hasToken(), false);
  }
});
