import { describe, expect, it } from "vitest";
import { retryDelayMs, scheduleIdempotencyKey, validateSchedule } from "../scheduler-runtime";

describe("Phase L scheduler runtime",()=>{
 it("accepts valid durable schedules",()=>expect(validateSchedule({ownerId:"u",name:"Daily job",kind:"interval",expression:"3600",taskType:"report.refresh",timezone:"UTC",payload:{},enabled:true,nextRunAt:null}).ok).toBe(true));
 it("rejects unsafe interval values",()=>expect(validateSchedule({ownerId:"u",name:"bad",kind:"interval",expression:"0",taskType:"x",timezone:"UTC",payload:{},enabled:true,nextRunAt:null}).ok).toBe(false));
 it("requires five cron fields",()=>expect(validateSchedule({ownerId:"u",name:"cron",kind:"cron",expression:"* * *",taskType:"x",timezone:"UTC",payload:{},enabled:true,nextRunAt:null}).ok).toBe(false));
 it("creates deterministic idempotency keys",()=>expect(scheduleIdempotencyKey("s","2026-09-11T00:00:00Z")).toBe("schedule:s:2026-09-11T00:00:00.000Z"));
 it("uses bounded exponential retry",()=>{expect(retryDelayMs(1)).toBe(5000);expect(retryDelayMs(20)).toBe(300000);});
});
