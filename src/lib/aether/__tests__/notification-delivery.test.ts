import { describe,expect,it } from "vitest";
import { buildEmailText,deliveryIdempotencyKey,isValidEmail,normalizeEmail,retryDelayMs } from "../notification-delivery";
import { validateNotificationOwnership } from "../notifications";
describe("Phase K notification delivery",()=>{
 it("normalizes and validates email addresses",()=>{expect(normalizeEmail("  USER@Example.COM ")).toBe("user@example.com");expect(isValidEmail("user@example.com")).toBe(true);expect(isValidEmail("bad")).toBe(false);});
 it("builds provider-neutral email text",()=>{expect(buildEmailText("x","Hello","/reports")).toContain("/reports");});
 it("uses stable delivery idempotency and bounded exponential retry",()=>{expect(deliveryIdempotencyKey("n1","email")).toBe("notification:n1:email");expect(retryDelayMs(1)).toBe(1000);expect(retryDelayMs(10)).toBe(30000);});
 it("blocks cross-user resources and non-admin admin audience",()=>{const p={recipient_id:"b",audience:"user" as const,event_type:"report.ready" as const,title:"x"};expect(validateNotificationOwnership(p,"a",false).ok).toBe(false);expect(validateNotificationOwnership({...p,audience:"admin"},"a",false).ok).toBe(false);expect(validateNotificationOwnership({...p,audience:"admin"},"a",true).ok).toBe(true);});
});
