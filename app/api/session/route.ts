import { NextRequest, NextResponse } from "next/server";
import { sessionCookieName, sessionCookieValue, validateAdminToken } from "@/lib/auth";
export async function POST(request:NextRequest){const body=await request.json().catch(()=>({}));if(!validateAdminToken(String(body.token||"")))return NextResponse.json({ok:false,error:"invalid_token"},{status:401});const r=NextResponse.json({ok:true});r.cookies.set(sessionCookieName,sessionCookieValue(),{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:60*60*12});return r}
export async function DELETE(){const r=NextResponse.json({ok:true});r.cookies.set(sessionCookieName,"",{httpOnly:true,path:"/",maxAge:0});return r}
