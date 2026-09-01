import { uiAuthorized } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";
import Dashboard from "@/components/Dashboard";

export default async function Page(){return <main className="shell">{await uiAuthorized()?<><div className="topbar"><div className="brand"><span className="brand-mark">L</span>LINK STUDY</div><span className="pill">Laboratorio de valor</span></div><Dashboard/></>:<LoginForm/>}</main>}
