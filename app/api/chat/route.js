// V20-PROXY — Roteador trivial que sempre delega pra Supabase Edge Function
// Vantagem: este arquivo NUNCA mais precisa ser atualizado.
// Toda lógica/upgrades vão pra Edge Function (deploy via API, ilimitado, grátis).
import{NextResponse}from'next/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;

const EDGE_URL='https://tpjvalzwkqwttvmszvie.supabase.co/functions/v1/daniela-chat';
const ANON=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'eyJhbGciOiJIUzI1NiIsImtpZCI6Iks2T29uVnpZTDF2bGYwSEoiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwanZhbHp3a3F3dHR2bXN6dmllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ0OTI4OTMsImV4cCI6MjA2MDA2ODg5M30.LBASD9OY8fSyP1ywS-LYzRbZ-_ZLHC7P56v0dFB3opQ';

export async function POST(req){
  try{
    const body=await req.json();
    const r=await fetch(EDGE_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json',apikey:ANON,Authorization:`Bearer ${ANON}`},
      body:JSON.stringify(body)});
    const d=await r.json();
    return NextResponse.json(d);
  }catch(e){
    return NextResponse.json({reply:`❌ proxy: ${e.message}`,error:e.message},{status:200});
  }
}

export async function GET(){
  try{
    const r=await fetch(EDGE_URL,{headers:{apikey:ANON,Authorization:`Bearer ${ANON}`}});
    const d=await r.json();
    return NextResponse.json({...d,proxy:'V20 — proxy-only (todo upgrade via Supabase Edge SQL/API, sem deploy Vercel)'});
  }catch(e){
    return NextResponse.json({error:e.message},{status:500});
  }
}
