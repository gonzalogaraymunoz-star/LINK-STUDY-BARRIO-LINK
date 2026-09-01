"use client";
import { useState } from "react";

export default function LoginForm() {
  const [token,setToken]=useState(""); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");const r=await fetch("/api/session",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token})});if(r.ok){location.reload();return;}const j=await r.json().catch(()=>({}));setError(j.error||"Acceso rechazado");setBusy(false);}
  return <div className="login"><form className="panel login-card stack" onSubmit={submit}><div className="eyebrow">LINK STUDY</div><h2>Acceso al laboratorio</h2><p className="muted small">En producción la máquina exige el token de administración configurado en Vercel.</p><div className="field"><label>Token</label><input className="input" type="password" value={token} onChange={e=>setToken(e.target.value)} autoComplete="current-password" /></div>{error&&<div className="error small">{error}</div>}<button className="btn primary" disabled={busy||!token}>{busy?"Verificando…":"Entrar"}</button></form></div>;
}
