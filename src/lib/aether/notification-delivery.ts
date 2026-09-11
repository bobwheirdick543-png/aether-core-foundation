/** Phase K — provider-independent notification delivery primitives. */
export type DeliveryChannel = "in_app" | "email";
export type DeliveryAttempt = { channel: DeliveryChannel; destination: string; notificationId: string };
export type ProviderResult = { ok: true; providerMessageId?: string } | { ok: false; error: string };
export interface NotificationProvider { readonly key: string; send(attempt: DeliveryAttempt, subject: string, body: string, link?: string | null): Promise<ProviderResult>; }
export function buildEmailText(subject:string, body:string, link?:string|null):string { const clean=body.trim(); return link ? `${clean}\n\nOpen in Aether: ${link}` : clean; }
export function normalizeEmail(value:string):string { return value.trim().toLowerCase(); }
export function isValidEmail(value:string):boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value)); }
export function retryDelayMs(attempt:number, base=1000, max=30000):number { const n=Math.max(1,Math.floor(attempt)); return Math.min(max,base*2**(n-1)); }
export function deliveryIdempotencyKey(notificationId:string, channel:DeliveryChannel):string { return `notification:${notificationId}:${channel}`; }
export const noopEmailProvider: NotificationProvider = { key:"noop-email", async send(){ return {ok:false,error:"No email delivery provider is configured"}; } };
