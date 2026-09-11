/** Phase K — provider-independent notification delivery primitives. */
export type DeliveryChannel="in_app"|"email";
export type DeliveryAttempt={channel:DeliveryChannel;destination:string;notificationId:string};
export type ProviderResult={ok:true;providerMessageId?:string}|{ok:false;error:string};
export interface NotificationProvider{readonly key:string;send(attempt:DeliveryAttempt,subject:string,body:string,link?:string|null):Promise<ProviderResult>;}
export function buildEmailText(_subject:string,body:string,link?:string|null):string{const clean=body.trim();return link?`${clean}\n\nOpen in Aether: ${link}`:clean;}
export function normalizeEmail(value:string):string{return value.trim().toLowerCase();}
export function isValidEmail(value:string):boolean{return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));}
export function retryDelayMs(attempt:number,base=1000,max=30000):number{const n=Math.max(1,Math.floor(attempt));return Math.min(max,base*2**(n-1));}
export function deliveryIdempotencyKey(notificationId:string,channel:DeliveryChannel):string{return `notification:${notificationId}:${channel}`;}
export const noopEmailProvider:NotificationProvider={key:"noop-email",async send(){return {ok:false,error:"No email delivery provider is configured"};}};
/** Optional Resend adapter. It is inactive unless RESEND_API_KEY is present on the server. */
export const resendEmailProvider:NotificationProvider={key:"resend",async send(attempt,subject,body,link){const key=process.env.RESEND_API_KEY;const from=process.env.AETHER_EMAIL_FROM;if(!key||!from)return {ok:false,error:"Email provider is not configured"};try{const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({from,to:[attempt.destination],subject,text:buildEmailText(subject,body,link)})});const data=await r.json() as {id?:string;message?:string};if(!r.ok)return {ok:false,error:data.message||`Email provider returned ${r.status}`};return {ok:true,providerMessageId:data.id};}catch(e){return {ok:false,error:e instanceof Error?e.message:"Email provider request failed"};}}};
