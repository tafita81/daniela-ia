// @ts-nocheck
// app/api/cron/route.js — daily auto-update + health check every 6h
import { NextResponse } from 'next/server';
const SBU=process.env.NEXT_PUBLIC_SUPABASE_URL||'';
const SBK=process.env.SUPABASE_SERVICE_KEY||'';

export const runtime='nodejs';

export async function GET(){
  const results={};

  // 1. Health check all providers
  try{
    const r=await fetch(`${process.env.VERCEL_URL?'https://'+process.env.VERCEL_URL:''}/api/health`,
      {signal:AbortSignal.timeout(20000)});
    if(r.ok){const d=await r.json();results.health=d.health;results.best=d.best;}
  }catch(e){results.health_error=e.message;}

  // 2. Check Claude news
  try{
    const r=await fetch('https://www.anthropic.com/news',{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(8000)});
    const html=await r.text();
    const titles=[];const rx=/<h3[^>]*>([^<]{10,80})<\/h3>/g;let m;
    while((m=rx.exec(html))&&titles.length<5)titles.push(m[1].trim());
    if(titles.length&&SBU&&SBK){
      const news=`🆕 Novidades Claude (${new Date().toLocaleDateString('pt-BR')}):\n${titles.map(t=>`• ${t}`).join('\n')}`;
      await fetch(`${SBU}/rest/v1/ia_cache`,{method:'POST',
        headers:{apikey:SBK,Authorization:`Bearer ${SBK}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates'},
        body:JSON.stringify({cache_key:'daily_claude_news',value:news,expires_at:new Date(Date.now()+7*864e5).toISOString()})});
      results.news={found:titles.length,saved:true};
    }
  }catch(e){results.news_error=e.message;}

  // 3. Reset Groq token counter daily
  if(SBU&&SBK){
    try{
      const r2=await fetch(`${SBU}/rest/v1/ia_cache?cache_key=eq.token_state&select=value`,
        {headers:{apikey:SBK,Authorization:`Bearer ${SBK}`}});
      const d2=await r2.json();
      if(d2[0]?.value){
        const state=JSON.parse(d2[0].value);
        if(Date.now()-state.last_reset>86400000){
          state.used=0;state.last_reset=Date.now();state.chain_idx=0;
          state.model='llama-3.3-70b-versatile';state.provider='groq';
          await fetch(`${SBU}/rest/v1/ia_cache`,{method:'POST',
            headers:{apikey:SBK,Authorization:`Bearer ${SBK}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates'},
            body:JSON.stringify({cache_key:'token_state',value:JSON.stringify(state),
              expires_at:new Date(Date.now()+7*864e5).toISOString()})});
          results.token_reset=true;
        }
      }
    }catch(e){results.token_error=e.message;}
  }

  results.ts=new Date().toISOString();
  return NextResponse.json({ok:true,...results});
}
