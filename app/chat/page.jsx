"use client";
import { useEffect } from "react";

// Redirecionamento INSTANTÂNEO para o chat hospedado na Edge Function (zero limite Vercel)
export default function ChatRedirect() {
  useEffect(() => {
    window.location.replace("https://tpjvalzwkqwttvmszvie.supabase.co/functions/v1/daniela-app");
  }, []);
  return (
    <div style={{
      background:"#0a0a0f", color:"#f0f0f8", height:"100vh",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"-apple-system, sans-serif", textAlign:"center", padding:20
    }}>
      <div>
        <div style={{fontSize:48, marginBottom:12}}>🤖</div>
        <div style={{fontSize:18, fontWeight:700, marginBottom:8}}>Carregando Daniela...</div>
        <div style={{fontSize:13, color:"#888"}}>
          Se não redirecionar:{" "}
          <a href="https://tpjvalzwkqwttvmszvie.supabase.co/functions/v1/daniela-app"
             style={{color:"#a78bfa"}}>clique aqui</a>
        </div>
      </div>
    </div>
  );
}
