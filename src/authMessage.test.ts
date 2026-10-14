import assert from "node:assert/strict";
import { test } from "node:test";

import { authMessage } from "./authMessage.ts";

const callableError = (code: string, details?: unknown) => ({ code: `functions/${code}`, details });

test("a wrong username or password reads as one", () => {
  const wrong = "The username, email, or password is incorrect.";
  assert.equal(authMessage({ code: "auth/invalid-credential" }), wrong);
  assert.equal(authMessage(callableError("unauthenticated", { reason: "invalid-credentials" })), wrong);
});

test("a refusal that never reached the sign-in function is not blamed on the password", () => {
  // App Check turns a request away with the same code and no reason.
  for (const error of [
    callableError("unauthenticated"),
    callableError("unauthenticated", null),
    callableError("unauthenticated", { reason: "something-else" }),
  ]) {
    assert.match(authMessage(error), /couldn't verify this browser/);
    assert.doesNotMatch(authMessage(error), /incorrect/);
  }
});

test("a rate limit says to wait or use the email address", () => {
  assert.match(authMessage(callableError("resource-exhausted")), /Too many attempts\. Try again later/);
  assert.equal(authMessage({ code: "auth/too-many-requests" }), "Too many attempts. Wait a moment and try again.");
});

test("any other failure of the sign-in functions is temporary, not a wrong password", () => {
  for (const code of ["unavailable", "internal", "deadline-exceeded", "not-found"]) {
    assert.equal(authMessage(callableError(code)), "Sign-in is temporarily unavailable. Try again shortly.");
  }
});

test("Firebase Auth errors keep their own messages", () => {
  assert.equal(authMessage({ code: "auth/invalid-email" }), "Enter a valid username or email address.");
  assert.equal(authMessage({ code: "auth/user-disabled" }), "This account has been disabled.");
  assert.match(authMessage({ code: "auth/popup-blocked" }), /blocked the Apple sign-in window/);
  assert.match(authMessage({ code: "auth/operation-not-allowed" }), /not enabled for this project/);
  assert.equal(authMessage({ code: "auth/some-new-code" }), "Sign-in failed. Please try again.");
});

test("anything that is not a Firebase error is a plain failure", () => {
  for (const error of [new Error("boom"), null, undefined, "text", { code: 7 }]) {
    assert.equal(authMessage(error), "Sign-in failed. Please try again.");
  }
});
