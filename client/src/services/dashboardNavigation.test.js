import test from "node:test";
import assert from "node:assert/strict";
import { dashboardPath, dashboardPage, sessionPath, writePath } from "./dashboardNavigation.js";

test("successful login and signup resolve to each role's own dashboard", () => {
 for (const [role,path] of [["applicant","/board"],["mentor","/mentor/students"],["admin","/admin/users"]]) {
  for (const start of ["/login","/signup","/"]) assert.equal(sessionPath(start,{role},false),path);
 }
});
test("session restoration waits, then retains authorized deep links and rejects other roles", () => {
 assert.equal(sessionPath("/analytics",null,true),"/analytics");
 assert.equal(sessionPath("/analytics",{role:"applicant"},false),"/analytics");
 assert.equal(dashboardPage("applicant","/analytics"),"analytics");
 assert.equal(sessionPath("/mentor/view",{role:"mentor"},false),"/mentor/view");
 assert.equal(sessionPath("/admin/health",{role:"admin"},false),"/admin/health");
 assert.equal(sessionPath("/admin/users",{role:"applicant"},false),"/board");
 assert.equal(sessionPath("/board",{role:"mentor"},false),"/mentor/students");
 for(const path of ["/board","/analytics","/mentor/view","/admin/users"]) assert.equal(sessionPath(path,null,false),"/login");
 for(const path of ["/login","/signup","/"]) assert.equal(sessionPath(path,null,false),path);
 assert.equal(sessionPath("/unknown",null,false),"/");
});
test("replace login, push page navigation, refresh, Back/Forward and logout stay canonical", () => {
 const entries=["/","/login"];let index=1;
 const location={get pathname(){return entries[index];}};
 const history={replaceState(_state,_title,path){entries[index]=path;},pushState(_state,_title,path){entries.splice(++index);entries.push(path);}};
 const user={role:"applicant"};
 writePath(history,location,sessionPath(location.pathname,user,false),true);
 assert.deepEqual(entries,["/","/board"]); // Submitted Login was replaced.
 writePath(history,location,dashboardPath(user.role,"analytics"));
 assert.equal(location.pathname,"/analytics");
 index--;assert.equal(dashboardPage(user.role,location.pathname),"board");
 index++;assert.equal(dashboardPage(user.role,location.pathname),"analytics");
 assert.equal(sessionPath(location.pathname,user,false),"/analytics"); // Refresh restore.
 writePath(history,location,"/",true); // Confirmed logout.
 index--;assert.equal(sessionPath(location.pathname,null,false),"/login");
 const before=entries.length;writePath(history,location,location.pathname);assert.equal(entries.length,before);
});
