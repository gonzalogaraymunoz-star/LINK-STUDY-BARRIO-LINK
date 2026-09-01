import type { NextRequest } from "next/server";
import { authorizeMcp } from "@/lib/mcp/access";
import { createStudyMcpHandler } from "@/lib/mcp/handler";
export const maxDuration=60;
const handler=createStudyMcpHandler();
async function secured(request:NextRequest){const access=authorizeMcp(request);if(!access.allowed)return Response.json({error:"mcp_access_denied",reason:access.reason},{status:401,headers:{"Access-Control-Allow-Origin":"*"}});return handler(request)}
export {secured as GET,secured as POST};
export function OPTIONS(){return new Response(null,{status:204,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Allow-Headers":"content-type, authorization, mcp-session-id, x-link-mcp-token","Access-Control-Expose-Headers":"Mcp-Session-Id"}})}
