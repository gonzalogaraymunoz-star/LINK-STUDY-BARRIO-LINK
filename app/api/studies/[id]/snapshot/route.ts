import { NextRequest,NextResponse } from "next/server";
import { requestAuthorized } from "@/lib/auth";
import { buildStudySnapshot } from "@/lib/study/context";
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){if(!requestAuthorized(request))return NextResponse.json({error:"unauthorized"},{status:401});try{const {id}=await params;const snapshot=await buildStudySnapshot(id,"human");return NextResponse.json({snapshot})}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"snapshot_failed"},{status:500})}}
