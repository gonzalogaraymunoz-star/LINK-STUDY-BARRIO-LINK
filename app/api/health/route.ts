import { NextResponse } from "next/server";
import { getCentralSupabase } from "@/lib/supabase/server";
import { mirofishHealth } from "@/lib/mirofish/client";
export async function GET(){const sb=getCentralSupabase();let supabase="not_configured";if(sb){const {error}=await sb.from("study_studies").select("id",{head:true,count:"exact"});supabase=error?"error":"ok"}return NextResponse.json({ok:supabase==="ok",service:"link-study",supabase,mirofish:await mirofishHealth(),timestamp:new Date().toISOString()})}
