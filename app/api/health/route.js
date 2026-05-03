// @ts-nocheck
// app/api/health/route.js — testa todos os providers em paralelo + salva estado
import { NextResponse } from 'next/server';
const GK=process.env.GROQ_API_KEY||'';
const GEK=process.env.GEMINI_API_KEY||'';
const CHK=process.env.COHERE_API_KEY||'';
const TGK=process.env.TOGETHER_API_KEY||'';
const SBU=process.env.NEXT_PUBLIC_SUPABASE_URL||'';
const SBK=process.env.SUPABASE_SERVICE_KEY||'';

export const runtime='nodejs';
export const maxDuration=25;

async function testProvider(name, fn){
  try{
    const start=Date.now();
    const result=await Promise.race([fn(),new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),8000))]);
    return{name,ok:true,ms:Date.now()-start,reply:result};
  }catch(e){return{name,ok:false,error:e.message};}
}

export async function GET(){
  const now=new Date();

  // Testa todos em paralelo
  const tests=await Promise.all([
    GK?testProvider('groq',async()=>{
      const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',
        headers:{Authorization:`Bearer ${GK}`,'Content-Type':'application/json'},
        body:JSON.stringify({model:'llama-3.3-70b-versatile',messages:[{role:'user',content:'1+1='}],max_tokens:3})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error?.message||`HTTP ${r.status}`);
      return d.choices[0].message.content;
    }):Promise.resolve({name:'groq',ok:false,error:'no key'}),

    GEK?testProvider('gemini',async()=>{
      const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEK}`,{method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({contents:[{role:'user',parts:[{text:'1+1='}]}],generationConfig:{maxOutputTokens:3}})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error?.message||`HTTP ${r.status}`);
      return d.candidates[0].content.parts[0].text;
    }):Promise.resolve({name:'gemini',ok:false,error:'no key'}),

    CHK?testProvider('cohere',async()=>{
      const r=await fetch('https://api.cohere.com/v2/chat',{method:'POST',
        headers:{Authorization:`Bearer ${CHK}`,'Content-Type':'application/json'},
        body:JSON.stringify({model:'command-r-08-2024',messages:[{role:'user',content:'1+1='}],max_tokens:3})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.message||`HTTP ${r.status}`);
      return d.message.content[0].text;
    }):Promise.resolve({name:'cohere',ok:false,error:'no key'}),

    TGK?testProvider('together',async()=>{
      const r=await fetch('https://api.together.xyz/v1/chat/completions',{method:'POST',
        headers:{Authorization:`Bearer ${TGK}`,'Content-Type':'application/json'},
        body:JSON.stringify({model:'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',messages:[{role:'user',content:'1+1='}],max_tokens:3})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error?.message||`HTTP ${r.status}`);
      return d.choices[0].message.content;
    }):Promise.resolve({name:'together',ok:false,error:'no key'}),
  ]);

  const health={};
  for(const t of tests) health[t.name]={ok:t.ok,ms:t.ms,error:t.error,reply:t.reply};
  const anyOk=Object.values(health).some(h=>h.ok);
  const best=tests.find(t=>t.ok);

  // Salva no Supabase para o cron monitorar
  if(SBU&&SBK){
    fetch(`${SBU}/rest/v1/ia_cache`,{method:'POST',
      headers:{apikey:SBK,Authorization:`Bearer ${SBK}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates'},
      body:JSON.stringify({cache_key:'health_status',value:JSON.stringify({health,checked_at:now.toISOString(),best:best?.name}),
        expires_at:new Date(Date.now()+2*864e5).toISOString()})}).catch(()=>{});
  }

  return NextResponse.json({
    ok:anyOk,
    health,
    best:best?.name||null,
    checked_at:now.toISOString(),
    server_time:now.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}),
  });
}
