import test from "node:test";
import assert from "node:assert/strict";
import { publicScreen, publicPath } from "./publicNavigation.js";

test("guest screens and invite-email routes stay in sync without exposing preview/admin routes", () => {
  assert.equal(publicScreen("/login"), "login"); assert.equal(publicScreen("/signup"), "signup");
  assert.equal(publicScreen("/admin"), "welcome"); assert.equal(publicScreen("/"), "welcome");
  assert.equal(publicPath("login"), "/login"); assert.equal(publicPath("signup"), "/signup");
  assert.equal(publicPath("welcome"), "/"); assert.equal(publicPath("adminPreview"), "/");
});
