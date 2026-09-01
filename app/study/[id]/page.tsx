import { uiAuthorized } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";
import StudyView from "@/components/StudyView";

export default async function StudyPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <main className="shell">{await uiAuthorized()?<StudyView id={id}/>:<LoginForm/>}</main>}
