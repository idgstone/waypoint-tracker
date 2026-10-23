import test from "node:test";
import assert from "node:assert/strict";
import { developmentPreviewsEnabled } from "./developmentPreviews.js";
test("previews default off in dev and require explicit string true; production always denies",()=>{
 for(const env of [undefined,{}, {DEV:true},{DEV:true,VITE_ENABLE_PREVIEWS:"false"},{DEV:true,VITE_ENABLE_PREVIEWS:true},{DEV:false,VITE_ENABLE_PREVIEWS:"true"}]) assert.equal(developmentPreviewsEnabled(env),false);
 assert.equal(developmentPreviewsEnabled({DEV:true,VITE_ENABLE_PREVIEWS:"true"}),true);
});
