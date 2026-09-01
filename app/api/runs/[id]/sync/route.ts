import { NextRequest,NextResponse } from "next/server";
import { requestAuthorized } from "@/lib/auth";
import { syncMirofishRun } from "@/lib/mirofish/client";
export const maxDuration=60;
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){if(!requestAuthorized(request))return NextResponse.json({error:"unauthorized"},{status:401});try{const {id}=await params;return NextResponse.json({run:await syncMirofishRun(id,"human")})}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"mirofish_sync_failed"},{status:502})}}
