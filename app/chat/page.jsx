"use client";
import { useEffect } from "react";

export default function ChatRedirect() {
  useEffect(() => {
    window.location.replace("https://repovazio.vercel.app/daniela.html");
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
          <a href="https://repovazio.vercel.app/daniela.html" style={{color:"#a78bfa"}}>clique aqui</a>
        </div>
      </div>
    </div>
  );
}
