/**
 * AETHER SCHEDULER FOUNDATION
 *
 * Persistent schedule definitions for long-running and recurring work.
 * A Task can have a schedule; each firing produces a new Run.
 *
 * No background worker in this file — pure types + next-run calculation.
 */

export type ScheduleType =
  | "one_time"
  | "delayed"
  | "recurring"
  | "interval"
  | "date_range"
  | "event";

export interface ScheduleDefinition {
  id?: string;
  task_id?: string;
  type: ScheduleType;
  enabled: boolean;
  /** ISO timestamp for one_time / delayed / date_range start */
  start_at?: string | null;
  /** ISO timestamp for date_range end */
  end_at?: string | null;
  /** Cron expression (recurring) — optional, future parser */
  cron?: string | null;
  /** Interval in minutes (interval type) */
  interval_minutes?: number | null;
  /** Human description e.g. "every day at 08:00" */
  description?: string | null;
  /** Event name for event-triggered schedules */
  event_name?: string | null;
  last_fired_at?: string | null;
  next_fire_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Calculate the next fire time for simple schedule types.
 * Returns null when the schedule is finished or disabled.
 */
export function calculateNextFire(
  schedule: ScheduleDefinition,
  from: Date = new Date(),
): Date | null {
  if (!schedule.enabled) return null;

  const now = from.getTime();

  switch (schedule.type) {
    case "one_time":
    case "delayed": {
      if (!schedule.start_at) return null;
      const t = new Date(schedule.start_at).getTime();
      return t > now ? new Date(t) : null;
    }

    case "interval": {
      const minutes = schedule.interval_minutes ?? 60;
      if (minutes <= 0) return null;
      const last = schedule.last_fired_at
        ? new Date(schedule.last_fired_at).getTime()
        : schedule.start_at
          ? new Date(schedule.start_at).getTime()
          : now;
      const next = last + minutes * 60_000;
      if (schedule.end_at && next > new Date(schedule.end_at).getTime()) return null;
      return new Date(Math.max(next, now + 1000));
    }

    case "date_range": {
      if (!schedule.start_at) return null;
      const start = new Date(schedule.start_at).getTime();
      const end = schedule.end_at ? new Date(schedule.end_at).getTime() : Infinity;
      if (now > end) return null;
      if (now < start) return new Date(start);
      // Within range — for pure date_range without interval we fire once at start
      return schedule.last_fired_at ? null : new Date(start);
    }

    case "recurring":
      // Full cron parsing is deferred; for now treat as disabled until a parser is added
      return null;

    case "event":
      // Event-triggered — no time-based next fire
      return null;

    default:
      return null;
  }
}

/** Human-readable summary of a schedule */
export function describeSchedule(s: ScheduleDefinition): string {
  if (!s.enabled) return "Disabled";
  switch (s.type) {
    case "one_time":
      return s.start_at ? `Once at ${new Date(s.start_at).toLocaleString()}` : "One-time (no time set)";
    case "delayed":
      return s.start_at ? `Delayed until ${new Date(s.start_at).toLocaleString()}` : "Delayed";
    case "interval":
      return `Every ${s.interval_minutes ?? "?"} minutes`;
    case "date_range":
      return `From ${s.start_at ?? "?"} to ${s.end_at ?? "∞"}`;
    case "recurring":
      return s.cron ? `Cron: ${s.cron}` : "Recurring";
    case "event":
      return s.event_name ? `On event: ${s.event_name}` : "Event-triggered";
    default:
      return "Unknown schedule";
  }
}
