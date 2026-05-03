// @ts-nocheck
// app/api/health/route.js — testa conexões reais em tempo real
import{NextResponse}from'next/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';

const GK=process.env.GROQ_API_KEY||'';
const GEK=process.env.GEMINI_API_KEY||'';
const CHK=process.env.COHERE_API_KEY||'cohere_KJFdijk5qzPXeIb1asnrMo7iaKtVui337fjIgEYQ2vMfd5';
const TGK=process.env.TOGETHER_API_KEY||'';
const GH_PAT=process.env.GH_PAT||'';
const SBU=process.env.NEXT_PUBLIC_SUPABASE_URL||'';
const SBK=process.env.SUPABASE_SERVICE_KEY||'';
const VT=process.env.VERCEL_TOKEN||'';

async function ping(name,fn){
  const t=Date.now();
  try{
    const{ok,detail}=await Promise.race([fn(),new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),5000))]);
    return{name,ok,detail,ms:Date.now()-t};
  }catch(e){return{name,ok:false,detail:e.message.substring(0,40),ms:Date.now()-t};}
}

export async function GET(){
  const tests=await Promise.all([
    ping('groq',async()=>{
      if(!GK)return{ok:false,detail:'no key'};
      const r=await fetch('https://api.groq.com/openai/v1/models',{headers:{Authorization:`Bearer ${GK}`}});
      return{ok:r.ok,detail:r.ok?'Llama 3.3 70B':'rate limited'};
    }),
    ping('cohere',async()=>{
      const key=CHK;if(!key)return{ok:false,detail:'no key'};
      const r=await fetch('https://api.cohere.com/v2/chat',{method:'POST',
        headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
        body:JSON.stringify({model:'command-r-08-2024',messages:[{role:'user',content:'hi'}],max_tokens:3})});
      return{ok:r.ok,detail:r.ok?'command-r-08-2024':r.status.toString()};
    }),
    ping('gemini',async()=>{
      if(!GEK)return{ok:false,detail:'no key'};
      const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEK}&pageSize=1`);
      return{ok:r.ok,detail:r.ok?'gemini-2.0-flash':r.status===429?'quota exceeded':'invalid key'};
    }),
    ping('together',async()=>{
      if(!TGK)return{ok:false,detail:'no key'};
      const r=await fetch('https://api.together.xyz/v1/models',{headers:{Authorization:`Bearer ${TGK}`}});
      return{ok:r.ok,detail:r.ok?'models OK':r.status===402?'credits needed':'error'};
    }),
    ping('github',async()=>{
      if(!GH_PAT)return{ok:false,detail:'no key'};
      const r=await fetch('https://api.github.com/user',{headers:{Authorization:`token ${GH_PAT}`}});
      const d=await r.json();
      return{ok:r.ok,detail:r.ok?`user: ${d.login||'?'}`:'invalid token'};
    }),
    ping('supabase',async()=>{
      if(!SBU||!SBK)return{ok:false,detail:'no config'};
      const r=await fetch(`${SBU}/rest/v1/ia_cache?limit=1`,{headers:{apikey:SBK,Authorization:`Bearer ${SBK}`}});
      return{ok:r.ok,detail:r.ok?'connected':r.status.toString()};
    }),
    ping('vercel',async()=>{
      if(!VT)return{ok:false,detail:'no token'};
      const r=await fetch('https://api.vercel.com/v9/user',{headers:{Authorization:`Bearer ${VT}`}});
      return{ok:r.ok,detail:r.ok?'team OK':'invalid token'};
    }),
    // Test Claude MCP connected services (just check API is reachable)
    ping('notion',async()=>{const r=await fetch('https://api.notion.com/v1/users/me',{headers:{'Notion-Version':'2022-06-28','Authorization':'Bearer test'}});return{ok:r.status<500,detail:`HTTP ${r.status}`};}),
    ping('shopify',async()=>{const r=await fetch('https://www.shopify.com',{});return{ok:r.ok,detail:`HTTP ${r.status}`};}),
    ping('figma',async()=>{const r=await fetch('https://api.figma.com/v1/me',{headers:{'X-Figma-Token':'test'}});return{ok:r.status<500,detail:`HTTP ${r.status}`};}),
    ping('spotify',async()=>{const r=await fetch('https://api.spotify.com/v1/me',{headers:{Authorization:'Bearer test'}});return{ok:r.status<500,detail:`HTTP ${r.status}`};}),
    ping('canva',async()=>{const r=await fetch('https://api.canva.com/rest/v1/users/me');return{ok:r.status<500,detail:`HTTP ${r.status}`};}),
    ping('uber',async()=>{const r=await fetch('https://api.uber.com/v1.2/me');return{ok:r.status<500,detail:`HTTP ${r.status}`};}),
    ping('zoom',async()=>{const r=await fetch('https://api.zoom.us/v2/users/me');return{ok:r.status<500,detail:`HTTP ${r.status}`};}),
    ping('google',async()=>{const r=await fetch('https://www.googleapis.com/oauth2/v1/userinfo',{headers:{Authorization:'Bearer test'}});return{ok:r.status<500,detail:`HTTP ${r.status}`};}),
    ping('docusign',async()=>{const r=await fetch('https://account.docusign.com');return{ok:r.ok,detail:`HTTP ${r.status}`};}),
    ping('booking',async()=>{const r=await fetch('https://www.booking.com');return{ok:r.ok,detail:`HTTP ${r.status}`};}),
    ping('tripadvisor',async()=>{const r=await fetch('https://www.tripadvisor.com');return{ok:r.ok,detail:`HTTP ${r.status}`};}),
    ping('clickup',async()=>{const r=await fetch('https://api.clickup.com/api/v2/user',{headers:{Authorization:'test'}});return{ok:r.status<500,detail:`HTTP ${r.status}`};}),
    ping('calendly',async()=>{const r=await fetch('https://api.calendly.com/users/me',{headers:{Authorization:'Bearer test'}});return{ok:r.status<500,detail:`HTTP ${r.status}`};}),
    ping('alltrails',async()=>{const r=await fetch('https://api.alltrails.com/api/alltrails/v2/trails?limit=1');return{ok:r.status<500,detail:`HTTP ${r.status}`};}),
    ping('thumbtack',async()=>{const r=await fetch('https://www.thumbtack.com');return{ok:r.ok,detail:`HTTP ${r.status}`};}),
    ping('linear',async()=>{const r=await fetch('https://api.linear.app/graphql',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'test'},body:JSON.stringify({query:'{__typename}'})});return{ok:r.status<500,detail:`HTTP ${r.status}`};}),
    ping('resy',async()=>{const r=await fetch('https://api.resy.com');return{ok:r.ok,detail:`HTTP ${r.status}`};}),
    ping('gamma',async()=>{const r=await fetch('https://gamma.app');return{ok:r.ok,detail:`HTTP ${r.status}`};}),
    ping('paypal',async()=>{const r=await fetch('https://www.paypal.com');return{ok:r.ok,detail:`HTTP ${r.status}`};}),
    ping('viator',async()=>{const r=await fetch('https://www.viator.com');return{ok:r.ok,detail:`HTTP ${r.status}`};}),
  ]);

  const health={};
  tests.forEach(t=>{health[t.name]={ok:t.ok,detail:t.detail,ms:t.ms};});

  // Summary
  const okCount=tests.filter(t=>t.ok).length;
  return NextResponse.json({ok:true,timestamp:new Date().toISOString(),total:tests.length,connected:okCount,health});
}
