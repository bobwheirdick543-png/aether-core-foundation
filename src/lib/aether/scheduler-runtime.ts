/** Phase L — deterministic, provider-independent schedule semantics. */
export type ScheduleKind = "once" | "interval" | "cron";

export interface ScheduleInput {
  ownerId: string;
  name: string;
  description?: string | null;
  kind: ScheduleKind;
  expression: string;
  timezone: string;
  taskType: string;
  payload: Record<string, unknown>;
  enabled: boolean;
  nextRunAt: string | null;
}

const CRON_RANGES: ReadonlyArray<[number, number]> = [[0, 59], [0, 23], [1, 31], [1, 12], [1, 7]];

function validTimezone(timezone: string): boolean {
  try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date()); return true; } catch { return false; }
}

function parseCronPart(part: string, min: number, max: number): Set<number> | null {
  const values = new Set<number>();
  for (const raw of part.split(",")) {
    if (!raw) return null;
    const [base, rawStep, extra] = raw.split("/");
    if (extra !== undefined || (rawStep !== undefined && (!/^\d+$/.test(rawStep) || Number(rawStep) < 1))) return null;
    const step = rawStep === undefined ? 1 : Number(rawStep);
    let start = min; let end = max;
    if (base !== "*") {
      const range = base.match(/^(\d+)(?:-(\d+))?$/);
      if (!range) return null;
      start = Number(range[1]); end = range[2] === undefined ? start : Number(range[2]);
    }
    if (min === 1 && max === 7 && start === 0) start = 7;
    if (min === 1 && max === 7 && end === 0) end = 7;
    if (start < min || end > max || start > end) return null;
    for (let value = start; value <= end; value += step) values.add(value);
  }
  return values;
}

export function validateCron(expression: string): boolean {
  const fields = expression.trim().split(/\s+/);
  return fields.length === 5 && fields.every((field, index) => parseCronPart(field, ...CRON_RANGES[index]) !== null);
}

export function cronMatches(expression: string, date: Date, timezone = "UTC"): boolean {
  if (!validateCron(expression) || !validTimezone(timezone)) return false;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hourCycle: "h23", minute: "2-digit", hour: "2-digit", day: "2-digit", month: "2-digit", weekday: "short" }).formatToParts(date);
  const numberPart = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? NaN);
  const weekdayName = parts.find((part) => part.type === "weekday")?.value;
  const weekdayIndex = weekdayName ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekdayName) : -1;
  const values = [numberPart("minute"), numberPart("hour"), numberPart("day"), numberPart("month"), weekdayIndex === 0 ? 7 : weekdayIndex];
  return expression.trim().split(/\s+/).every((field, index) => parseCronPart(field, ...CRON_RANGES[index])?.has(values[index]) ?? false);
}

/** Returns the first cron occurrence strictly after `after`, capped at one year. */
export function nextCronRun(expression: string, after: Date, timezone = "UTC"): Date | null {
  if (!validateCron(expression) || !validTimezone(timezone)) return null;
  const cursor = new Date(Math.floor(after.getTime() / 60_000) * 60_000 + 60_000);
  for (let i = 0; i < 366 * 24 * 60; i += 1) {
    if (cronMatches(expression, cursor, timezone)) return new Date(cursor);
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  }
  return null;
}

export function calculateNextRunAt(input: Pick<ScheduleInput, "kind" | "expression" | "timezone" | "enabled">, from = new Date()): Date | null {
  if (!input.enabled || !validTimezone(input.timezone || "UTC")) return null;
  if (input.kind === "once") { const at = new Date(input.expression); return Number.isNaN(at.getTime()) || at <= from ? null : at; }
  if (input.kind === "interval") { if (!/^\d+$/.test(input.expression) || Number(input.expression) < 1) return null; return new Date(from.getTime() + Number(input.expression) * 1000); }
  return nextCronRun(input.expression, from, input.timezone || "UTC");
}

export function validateSchedule(input: Partial<ScheduleInput>): { ok: true } | { ok: false; message: string } {
  if (!input.ownerId) return { ok: false, message: "ownerId is required" };
  if (!input.name?.trim()) return { ok: false, message: "Schedule name is required" };
  if (!input.kind || !["once", "interval", "cron"].includes(input.kind)) return { ok: false, message: "Unsupported schedule kind" };
  if (!input.expression?.trim()) return { ok: false, message: "Schedule expression is required" };
  if (!input.taskType?.trim()) return { ok: false, message: "taskType is required" };
  if (!input.timezone || !validTimezone(input.timezone)) return { ok: false, message: "Invalid IANA timezone" };
  if (input.kind === "interval" && (!/^\d+$/.test(input.expression) || Number(input.expression) < 1)) return { ok: false, message: "Interval must be a positive number of seconds" };
  if (input.kind === "cron" && !validateCron(input.expression)) return { ok: false, message: "Cron expression is invalid; use five fields with lists, ranges or steps" };
  if (input.kind === "once" && Number.isNaN(new Date(input.expression).getTime())) return { ok: false, message: "One-time expression must be a valid timestamp" };
  return { ok: true };
}

export function scheduleIdempotencyKey(scheduleId: string, scheduledFor: string): string { return `schedule:${scheduleId}:${new Date(scheduledFor).toISOString()}`; }
export function retryDelayMs(attempt: number, base = 5000, max = 300000): number { return Math.min(max, base * 2 ** Math.max(0, Math.floor(attempt) - 1)); }
