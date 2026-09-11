/**
 * AETHER SCHEDULER FOUNDATION
 *
 * Persistent schedule semantics are kept separate from execution. Phase L
 * stores schedules and run leases in Supabase; workers claim durable runs.
 */

export type ScheduleType = "one_time" | "delayed" | "recurring" | "interval" | "date_range" | "event";
export interface ScheduleDefinition { id?: string; task_id?: string; type: ScheduleType; enabled: boolean; start_at?: string|null; end_at?: string|null; cron?: string|null; interval_minutes?: number|null; description?: string|null; event_name?: string|null; last_fired_at?: string|null; next_fire_at?: string|null; created_at?: string; updated_at?: string; }

export function calculateNextFire(schedule:ScheduleDefinition,from:Date=new Date()):Date|null { if(!schedule.enabled)return null; const now=from.getTime(); switch(schedule.type){case "one_time":case "delayed":{if(!schedule.start_at)return null;const t=new Date(schedule.start_at).getTime();return t>now?new Date(t):null;}case "interval":{const minutes=schedule.interval_minutes??60;if(minutes<=0)return null;const last=schedule.last_fired_at?new Date(schedule.last_fired_at).getTime():schedule.start_at?new Date(schedule.start_at).getTime():now;const next=last+minutes*60_000;if(schedule.end_at&&next>new Date(schedule.end_at).getTime())return null;return new Date(Math.max(next,now+1000));}case "date_range":{if(!schedule.start_at)return null;const start=new Date(schedule.start_at).getTime();const end=schedule.end_at?new Date(schedule.end_at).getTime():Infinity;if(now>end)return null;return now<start?new Date(start):schedule.last_fired_at?null:new Date(start);}case "recurring":return null;case "event":return null;default:return null;} }
export function describeSchedule(s:ScheduleDefinition):string {if(!s.enabled)return "Disabled";switch(s.type){case "one_time":return s.start_at?`Once at ${new Date(s.start_at).toLocaleString()}`:"One-time (no time set)";case "delayed":return s.start_at?`Delayed until ${new Date(s.start_at).toLocaleString()}`:"Delayed";case "interval":return `Every ${s.interval_minutes??"?"} minutes`;case "date_range":return `From ${s.start_at??"?"} to ${s.end_at??"∞"}`;case "recurring":return s.cron?`Cron: ${s.cron}`:"Recurring";case "event":return s.event_name?`On event: ${s.event_name}`:"Event-triggered";default:return "Unknown schedule";}}

/** Durable worker retry policy. */
export function retryDelayMs(attempt:number,base=5000,max=300000):number{return Math.min(max,base*2**Math.max(0,Math.floor(attempt)-1));}
/** Stable key prevents duplicate execution when a worker restarts. */
export function runIdempotencyKey(scheduleId:string,scheduledFor:string):string{return `schedule:${scheduleId}:${new Date(scheduledFor).toISOString()}`;}
