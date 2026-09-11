import { describe, expect, it } from "vitest";
import { calculateNextRunAt, cronMatches, nextCronRun, retryDelayMs, scheduleIdempotencyKey, validateCron, validateSchedule } from "../scheduler-runtime";

describe("Phase L scheduler runtime", () => {
  it("accepts valid durable schedules", () => expect(validateSchedule({ ownerId: "u", name: "Daily job", kind: "interval", expression: "3600", taskType: "report.refresh", timezone: "UTC", payload: {}, enabled: true, nextRunAt: null }).ok).toBe(true));
  it("rejects unsafe interval values", () => expect(validateSchedule({ ownerId: "u", name: "bad", kind: "interval", expression: "0", taskType: "x", timezone: "UTC", payload: {}, enabled: true, nextRunAt: null }).ok).toBe(false));
  it("requires a valid five-field cron", () => { expect(validateCron("* * *")).toBe(false); expect(validateCron("*/5 * * * *")).toBe(true); expect(validateCron("0 25 * * *")).toBe(false); });
  it("matches cron in a supplied timezone", () => expect(cronMatches("0 9 * * 1-5", new Date("2026-09-11T09:00:00.000Z"), "UTC")).toBe(true));
  it("calculates the next cron occurrence", () => expect(nextCronRun("*/5 * * * *", new Date("2026-09-11T14:01:00.000Z"), "UTC")?.toISOString()).toBe("2026-09-11T14:05:00.000Z"));
  it("calculates interval and one-time occurrences", () => { const now = new Date("2026-09-11T14:00:00.000Z"); expect(calculateNextRunAt({ kind: "interval", expression: "60", timezone: "UTC", enabled: true }, now)?.toISOString()).toBe("2026-09-11T14:01:00.000Z"); expect(calculateNextRunAt({ kind: "once", expression: "2026-09-11T15:00:00.000Z", timezone: "UTC", enabled: true }, now)?.toISOString()).toBe("2026-09-11T15:00:00.000Z"); });
  it("creates deterministic idempotency keys", () => expect(scheduleIdempotencyKey("s", "2026-09-11T00:00:00Z")).toBe("schedule:s:2026-09-11T00:00:00.000Z"));
  it("uses bounded exponential retry", () => { expect(retryDelayMs(1)).toBe(5000); expect(retryDelayMs(20)).toBe(300000); });
});
