import { NextRequest,NextResponse } from "next/server";
import { requestAuthorized } from "@/lib/auth";
import { getStudy } from "@/lib/study/repository";
import { mirofishHealth } from "@/lib/mirofish/client";
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){if(!requestAuthorized(request))return NextResponse.json({error:"unauthorized"},{status:401});try{const {id}=await params;return NextResponse.json({...await getStudy(id),mirofish:await mirofishHealth()})}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"study_load_failed"},{status:500})}}
