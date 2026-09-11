import {describe,expect,it} from "vitest";
import {buildNotificationLink,validateNotificationOwnership} from "../notifications";
describe("Phase K authorization boundary",()=>{
 it("keeps user resource notifications scoped",()=>{const p={recipient_id:"recipient",audience:"user" as const,event_type:"report.ready" as const,title:"Report ready"};expect(validateNotificationOwnership(p,"other-user",false)).toEqual({ok:false,message:"Cross-user notification blocked: recipient does not own the referenced resource"});expect(validateNotificationOwnership(p,"recipient",false)).toEqual({ok:true});});
 it("requires admin recipients for admin events",()=>{const p={recipient_id:"u",audience:"admin" as const,event_type:"security.alert" as const,title:"Alert"};expect(validateNotificationOwnership(p,null,false).ok).toBe(false);expect(validateNotificationOwnership(p,null,true).ok).toBe(true);expect(buildNotificationLink("security.alert",{},true)).toBe("/admin/team");});
});
