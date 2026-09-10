import assert from "node:assert/strict";
import test from "node:test";
import {
  TIMEOUT_PRESETS_MS,
  MAX_TIMEOUT_MS,
  DEFAULT_TIMEOUT_MS,
  canTransition,
  assertTransition,
  resolveTimeoutMs,
  deadlineFromTimeout,
  exponentialBackoffMs,
  isRetryableFailure,
  isDeadlineExceeded,
} from "./task-runtime.ts";

test("Phase A timeout presets resolve exactly", () => {
  assert.equal(resolveTimeoutMs("20m"), TIMEOUT_PRESETS_MS["20m"]);
  assert.equal(resolveTimeoutMs("5h"), TIMEOUT_PRESETS_MS["5h"]);
  assert.equal(resolveTimeoutMs(undefined), DEFAULT_TIMEOUT_MS);
  assert.equal(resolveTimeoutMs(999_999_999), MAX_TIMEOUT_MS);
});

test("Phase A state machine rejects invalid transitions", () => {
  assert.equal(canTransition("queued", "running"), true);
  assert.equal(canTransition("completed", "running"), false);
  assert.doesNotThrow(() => assertTransition("running", "cancelled"));
  assert.throws(() => assertTransition("completed", "running"), /Invalid task\/run state transition/);
});

test("Phase A deadlines and retry backoff are deterministic", () => {
  const now = Date.UTC(2026, 0, 1);
  assert.equal(deadlineFromTimeout(60_000, now), new Date(now + 60_000).toISOString());
  assert.equal(isDeadlineExceeded(new Date(now - 1).toISOString(), now), true);
  assert.equal(isDeadlineExceeded(new Date(now + 1).toISOString(), now), false);
  assert.equal(exponentialBackoffMs(0), 5000);
  assert.equal(exponentialBackoffMs(1), 10000);
  assert.equal(exponentialBackoffMs(20), 300000);
});

test("Phase A retry classification never retries permanent failures", () => {
  for (const code of ["cancelled", "permission_denied", "invalid_input", "not_found", "policy_denied", "approval_rejected", "timeout_budget_exhausted"]) {
    assert.equal(isRetryableFailure(code), false, code);
  }
  assert.equal(isRetryableFailure("provider_timeout"), true);
  assert.equal(isRetryableFailure("worker_execution_failed"), true);
});
