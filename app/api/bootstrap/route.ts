import { NextRequest,NextResponse } from "next/server";
import { requestAuthorized } from "@/lib/auth";
import { listCatalog } from "@/lib/study/repository";
import { mirofishHealth } from "@/lib/mirofish/client";
export async function GET(request:NextRequest){if(!requestAuthorized(request))return NextResponse.json({error:"unauthorized"},{status:401});try{return NextResponse.json({...await listCatalog(),mirofish:await mirofishHealth()})}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"bootstrap_failed"},{status:500})}}
