// @ts-nocheck
// app/api/chat/route.js V16 — Daniela executa + sessões persistentes + Groq default real
import{NextResponse}from'next/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;

const OAI=process.env.OPENAI_API_KEY||'';
const GK=process.env.GROQ_API_KEY||'';
const GEK=process.env.GEMINI_API_KEY||'';
const CHK=process.env.COHERE_API_KEY||'cohere_KJFdijk5qzPXeIb1asnrMo7iaKtVui337fjIgEYQ2vMfd5';
const TGK=process.env.TOGETHER_API_KEY||'';
const GH_PAT=process.env.GH_PAT||'';
const VT=process.env.VERCEL_TOKEN||'';
const TEAM=process.env.VERCEL_TEAM_ID||'team_zr9vAef0Zz3njNAiGm3v5Y3h';
const SBU=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://tpjvalzwkqwttvmszvie.supabase.co';
const SBK=process.env.SUPABASE_SERVICE_KEY||'';

let stats={openai:{used:0,limit:200000,reset:Date.now()+86400000},groq:{used:0,limit:14400,reset:Date.now()+86400000},cohere:{used:0,limit:166666,reset:Date.now()+86400000},gemini:{used:0,limit:1500,reset:Date.now()+86400000}};
const SWITCH=0.80;
function bump(p,n=1){if(stats[p]){stats[p].used+=n;if(Date.now()>stats[p].reset){stats[p].used=0;stats[p].reset=Date.now()+86400000;}}}
function pct(p){return stats[p]?stats[p].used/stats[p].limit:0;}

// ── TOOLS REAIS ──────────────────────────────────────────────────────────
const TOOLS=[
{type:'function',function:{name:'web_search',description:'Pesquisa web',parameters:{type:'object',properties:{query:{type:'string'}},required:['query']}}},
{type:'function',function:{name:'web_fetch',description:'Baixa conteúdo de URL',parameters:{type:'object',properties:{url:{type:'string'}},required:['url']}}},
{type:'function',function:{name:'github_read',description:'Lê arquivo GitHub (repo: owner/name)',parameters:{type:'object',properties:{repo:{type:'string'},path:{type:'string'}},required:['repo','path']}}},
{type:'function',function:{name:'github_write',description:'Escreve/cria arquivo no GitHub e commita (Vercel re-deploya automaticamente)',parameters:{type:'object',properties:{repo:{type:'string'},path:{type:'string'},content:{type:'string'},message:{type:'string'}},required:['repo','path','content','message']}}},
{type:'function',function:{name:'github_list',description:'Lista arquivos de diretório GitHub',parameters:{type:'object',properties:{repo:{type:'string'},path:{type:'string'}},required:['repo','path']}}},
{type:'function',function:{name:'vercel_deploy_status',description:'Status do último deploy Vercel',parameters:{type:'object',properties:{project_id:{type:'string'}},required:['project_id']}}},
{type:'function',function:{name:'vercel_logs',description:'Logs runtime de deploy Vercel',parameters:{type:'object',properties:{project_id:{type:'string'}},required:['project_id']}}},
{type:'function',function:{name:'vercel_envs',description:'Lista env vars do projeto',parameters:{type:'object',properties:{project_id:{type:'string'}},required:['project_id']}}},
{type:'function',function:{name:'vercel_set_env',description:'Cria/atualiza env var',parameters:{type:'object',properties:{project_id:{type:'string'},key:{type:'string'},value:{type:'string'}},required:['project_id','key','value']}}},
{type:'function',function:{name:'health_check',description:'Health de todos provedores',parameters:{type:'object',properties:{}}}},
];

async function execTool(name,args){
  try{
    if(name==='web_search'){
      const r=await fetch(`https://duckduckgo.com/html?q=${encodeURIComponent(args.query)}`,{headers:{'User-Agent':'Mozilla/5.0'}});
      const html=await r.text();const out=[];const re=/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
      let m;while((m=re.exec(html))&&out.length<5)out.push({url:m[1],title:m[2]});
      return JSON.stringify({query:args.query,results:out});
    }
    if(name==='web_fetch'){
      const r=await fetch(args.url,{headers:{'User-Agent':'Mozilla/5.0'}});
      return(await r.text()).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').substring(0,4000);
    }
    if(name==='github_read'){
      const r=await fetch(`https://api.github.com/repos/${args.repo}/contents/${args.path}`,
        {headers:{Authorization:`token ${GH_PAT}`,Accept:'application/vnd.github.v3+json'}});
      if(!r.ok)return`erro: HTTP ${r.status}`;
      const d=await r.json();
      const c=Buffer.from(d.content,'base64').toString('utf-8');
      return JSON.stringify({path:d.path,sha:d.sha,size:d.size,content:c.substring(0,8000)});
    }
    if(name==='github_list'){
      const r=await fetch(`https://api.github.com/repos/${args.repo}/contents/${args.path}`,
        {headers:{Authorization:`token ${GH_PAT}`}});
      if(!r.ok)return`erro: HTTP ${r.status}`;
      const d=await r.json();
      return JSON.stringify(Array.isArray(d)?d.map(f=>({name:f.name,type:f.type,size:f.size})):d);
    }
    if(name==='github_write'){
      const url=`https://api.github.com/repos/${args.repo}/contents/${args.path}`;
      const ex=await fetch(url,{headers:{Authorization:`token ${GH_PAT}`}});
      const body={message:args.message,content:Buffer.from(args.content).toString('base64')};
      if(ex.ok){const ed=await ex.json();body.sha=ed.sha;}
      const r=await fetch(url,{method:'PUT',headers:{Authorization:`token ${GH_PAT}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
      const d=await r.json();
      return r.ok?`✅ Commit ${d.commit?.sha?.substring(0,7)} em ${args.repo}/${args.path}`:`❌ ${d.message}`;
    }
    if(name==='vercel_deploy_status'){
      const r=await fetch(`https://api.vercel.com/v6/deployments?projectId=${args.project_id}&teamId=${TEAM}&limit=1`,
        {headers:{Authorization:`Bearer ${VT}`}});
      const d=(await r.json()).deployments?.[0];
      return d?`Estado: ${d.state} | URL: https://${d.url} | Commit: ${d.meta?.githubCommitMessage||'?'}`:'sem deploys';
    }
    if(name==='vercel_logs'){
      const dr=await fetch(`https://api.vercel.com/v6/deployments?projectId=${args.project_id}&teamId=${TEAM}&limit=1`,
        {headers:{Authorization:`Bearer ${VT}`}});
      const dep=(await dr.json()).deployments?.[0];if(!dep)return'sem deploy';
      const r=await fetch(`https://api.vercel.com/v3/deployments/${dep.uid}/events?teamId=${TEAM}&limit=20`,
        {headers:{Authorization:`Bearer ${VT}`}});
      const ev=await r.json();
      return JSON.stringify((ev||[]).slice(-10).map(e=>({type:e.type,text:(e.payload?.text||'').substring(0,200)})));
    }
    if(name==='vercel_envs'){
      const r=await fetch(`https://api.vercel.com/v9/projects/${args.project_id}/env?teamId=${TEAM}`,
        {headers:{Authorization:`Bearer ${VT}`}});
      const d=await r.json();
      return JSON.stringify((d.envs||[]).map(e=>({key:e.key,target:e.target})));
    }
    if(name==='vercel_set_env'){
      const r=await fetch(`https://api.vercel.com/v10/projects/${args.project_id}/env?teamId=${TEAM}&upsert=true`,
        {method:'POST',headers:{Authorization:`Bearer ${VT}`,'Content-Type':'application/json'},
        body:JSON.stringify({key:args.key,value:args.value,type:'encrypted',target:['production','preview','development']})});
      const d=await r.json();
      return r.ok?`✅ ${args.key} setado`:`❌ ${d.error?.message||JSON.stringify(d).substring(0,200)}`;
    }
    if(name==='health_check'){
      const u=process.env.VERCEL_URL?`https://${process.env.VERCEL_URL}`:'https://daniela-ia.vercel.app';
      const r=await fetch(`${u}/api/health`);
      return r.ok?JSON.stringify(await r.json()).substring(0,2000):'health offline';
    }
    return`tool desconhecida: ${name}`;
  }catch(e){return`erro: ${e.message.substring(0,150)}`;}
}

// ── PROVEDORES ────────────────────────────────────────────────────────────
async function callOpenAI(messages,tools){
  if(!OAI)throw new Error('no_openai_key');
  const r=await fetch('https://api.openai.com/v1/chat/completions',{
    method:'POST',headers:{Authorization:`Bearer ${OAI}`,'Content-Type':'application/json'},
    body:JSON.stringify({model:'gpt-4.1-mini',messages,tools,tool_choice:'auto',max_tokens:2000,temperature:0.7})});
  if(!r.ok){const e=await r.json();throw new Error(`openai_${r.status}:${e.error?.message||''}`);}
  const d=await r.json();bump('openai',d.usage?.total_tokens||100);
  return{provider:'openai',model:'gpt-4.1-mini',message:d.choices[0].message};
}

async function callGroq(messages,tools){
  if(!GK)throw new Error('no_groq_key');
  const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{
    method:'POST',headers:{Authorization:`Bearer ${GK}`,'Content-Type':'application/json'},
    body:JSON.stringify({model:'llama-3.3-70b-versatile',messages,tools,tool_choice:'auto',max_tokens:2000,temperature:0.6})});
  if(!r.ok){const e=await r.json();throw new Error(`groq_${r.status}:${e.error?.message||''}`);}
  const d=await r.json();bump('groq',1);
  return{provider:'groq',model:'llama-3.3-70b',message:d.choices[0].message};
}

async function callGemini(messages,tools){
  if(!GEK)throw new Error('no_gemini_key');
  // Convert OpenAI format to Gemini
  const sys=messages.find(m=>m.role==='system')?.content||'';
  const contents=messages.filter(m=>m.role!=='system').map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content||''}]}));
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEK}`,
    {method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({systemInstruction:{parts:[{text:sys}]},contents,generationConfig:{maxOutputTokens:2000,temperature:0.6}})});
  if(!r.ok){const e=await r.json();throw new Error(`gemini_${r.status}:${e.error?.message||''}`);}
  const d=await r.json();bump('gemini',1);
  return{provider:'gemini',model:'gemini-2.0-flash',message:{role:'assistant',content:d.candidates?.[0]?.content?.parts?.[0]?.text||''}};
}

// Cohere SEM tools (Cohere v2 não suporta tool calling no formato OpenAI direto)
async function callCohere(messages){
  if(!CHK)throw new Error('no_cohere_key');
  const r=await fetch('https://api.cohere.com/v2/chat',{
    method:'POST',headers:{Authorization:`Bearer ${CHK}`,'Content-Type':'application/json'},
    body:JSON.stringify({model:'command-r-08-2024',messages,max_tokens:2000,temperature:0.6})});
  if(!r.ok){const e=await r.json();throw new Error(`cohere_${r.status}:${e.message||''}`);}
  const d=await r.json();bump('cohere',d.meta?.tokens?.output_tokens||100);
  return{provider:'cohere',model:'command-r',message:{role:'assistant',content:d.message?.content?.[0]?.text||''}};
}

// Cadeia: OpenAI > Groq > Gemini (todos suportam tools) > Cohere (last resort, SEM tools)
async function aiCall(messages,withTools){
  let last=null;
  // OpenAI primeiro (se tiver key VÁLIDA — falha rápido se 401)
  if(OAI&&pct('openai')<SWITCH){
    try{return await callOpenAI(messages,withTools?TOOLS:undefined);}catch(e){last=e.message;}
  }
  // Groq — supports tools, é o nosso real default
  if(GK&&pct('groq')<SWITCH){
    try{return await callGroq(messages,withTools?TOOLS:undefined);}catch(e){last=e.message;}
  }
  // Gemini — supports tools
  if(GEK&&pct('gemini')<SWITCH){
    try{return await callGemini(messages);}catch(e){last=e.message;}
  }
  // Cohere SEM tools (last resort)
  if(CHK){
    try{return await callCohere(messages);}catch(e){last=e.message;}
  }
  throw new Error(last||'todos provedores falharam');
}

// ── SESSÕES PERSISTENTES VIA SUPABASE ────────────────────────────────────
async function sbSet(key,value){
  if(!SBK)return false;
  try{
    const r=await fetch(`${SBU}/rest/v1/ia_cache`,{
      method:'POST',
      headers:{apikey:SBK,Authorization:`Bearer ${SBK}`,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates'},
      body:JSON.stringify({key,value:typeof value==='string'?value:JSON.stringify(value),updated_at:new Date().toISOString()})
    });
    return r.ok;
  }catch{return false;}
}

async function sbGet(key){
  if(!SBK)return null;
  try{
    const r=await fetch(`${SBU}/rest/v1/ia_cache?key=eq.${encodeURIComponent(key)}&select=value`,
      {headers:{apikey:SBK,Authorization:`Bearer ${SBK}`}});
    if(!r.ok)return null;
    const d=await r.json();
    if(!d?.[0]?.value)return null;
    try{return JSON.parse(d[0].value);}catch{return d[0].value;}
  }catch{return null;}
}

async function sbList(prefix,limit=50){
  if(!SBK)return[];
  try{
    const r=await fetch(`${SBU}/rest/v1/ia_cache?key=like.${encodeURIComponent(prefix)}*&select=key,value,updated_at&order=updated_at.desc&limit=${limit}`,
      {headers:{apikey:SBK,Authorization:`Bearer ${SBK}`}});
    if(!r.ok)return[];
    return(await r.json()).map(r=>{
      let v=r.value;try{v=JSON.parse(v);}catch{}
      return{key:r.key,value:v,updated_at:r.updated_at};
    });
  }catch{return[];}
}

async function sbDelete(key){
  if(!SBK)return false;
  try{
    const r=await fetch(`${SBU}/rest/v1/ia_cache?key=eq.${encodeURIComponent(key)}`,
      {method:'DELETE',headers:{apikey:SBK,Authorization:`Bearer ${SBK}`}});
    return r.ok;
  }catch{return false;}
}

// ── SYSTEM PROMPT ─────────────────────────────────────────────────────────
const SYS=`Você é Daniela Coelho — agente IA EXECUTORA do projeto psicologia.doc V16.

⚡ VOCÊ TEM ACESSO REAL A FERRAMENTAS QUE EXECUTAM:
• web_search, web_fetch — pesquisar/baixar páginas
• github_read, github_write, github_list — ler/escrever código (commit direto, Vercel re-deploya automático)
• vercel_deploy_status, vercel_logs, vercel_envs, vercel_set_env — gerenciar Vercel
• health_check — verificar todos os conectores

🎯 REPOS:
• tafita81/daniela-ia (prj_WLapekXHxYLOyylLGqTycwufKTVT) → daniela-ia.vercel.app
• tafita81/Repovazio (prj_rypXLpuS41CQt7sQYk5MM8kRQArr) → repovazio.vercel.app

⚠️ REGRAS CRÍTICAS:
1. Quando o usuário pedir "configure X", "deploy Y", "verifique Z", "edite W" — VOCÊ EXECUTA usando tools.
2. NUNCA diga "não tenho acesso a ferramentas" — VOCÊ TEM. USE-AS.
3. Para fazer deploy: github_write commita → Vercel detecta e re-deploya em ~90s. Use vercel_deploy_status para confirmar.
4. Após cada ação: reporte "✅ feito X (commit abc1234)" ou "❌ erro Y, tentando Z".
5. Português brasileiro, direto, técnico, sem floreio.
6. Tarefas complexas: planeje em 1 linha → execute em sequência → reporte.
7. NUNCA invente arquivos, commits, ou resultados — só fale o que de fato executou via tools.`;

// ── HANDLER POST ──────────────────────────────────────────────────────────
export async function POST(req){
  try{
    const body=await req.json();
    
    // Ações especiais (sessões)
    if(body._action==='session_save'&&body._session_id){
      const key=`chat:${body._user_id||'anon'}:${body._session_id}`;
      await sbSet(key,{title:body._title||'Chat',msgs:body.messages||[],updated_at:new Date().toISOString()});
      return NextResponse.json({ok:true,saved:key});
    }
    if(body._action==='sessions_list'){
      const list=await sbList(`chat:${body._user_id||'anon'}:`,50);
      return NextResponse.json({ok:true,sessions:list.map(s=>({id:s.key.split(':').pop(),title:s.value?.title||'Chat',updated_at:s.updated_at,msg_count:s.value?.msgs?.length||0}))});
    }
    if(body._action==='session_load'&&body._session_id){
      const v=await sbGet(`chat:${body._user_id||'anon'}:${body._session_id}`);
      return NextResponse.json({ok:true,session:v});
    }
    if(body._action==='session_delete'&&body._session_id){
      await sbDelete(`chat:${body._user_id||'anon'}:${body._session_id}`);
      return NextResponse.json({ok:true});
    }

    const userMsgs=Array.isArray(body.messages)?body.messages:[];
    const messages=[{role:'system',content:SYS},...userMsgs];

    // Loop de tools (até 8 iterações)
    let iters=0,used=[],reply='',prov='';
    while(iters<8){
      iters++;
      const{provider,model,message}=await aiCall(messages,true);
      prov=provider;

      if(message.tool_calls&&message.tool_calls.length){
        messages.push(message);
        for(const tc of message.tool_calls){
          let args={};try{args=JSON.parse(tc.function.arguments||'{}');}catch{}
          const result=await execTool(tc.function.name,args);
          used.push({name:tc.function.name,args});
          messages.push({role:'tool',tool_call_id:tc.id,content:result.substring(0,4000)});
        }
        continue;
      }
      reply=message.content||'';
      break;
    }

    // Auto-save da sessão se tiver session_id
    if(body.session_id){
      const allMsgs=[...userMsgs,{role:'assistant',content:reply}];
      const title=userMsgs[0]?.content?.substring(0,60)||'Chat';
      const key=`chat:${body.user_id||'anon'}:${body.session_id}`;
      sbSet(key,{title,msgs:allMsgs,updated_at:new Date().toISOString(),provider:prov}).catch(()=>{});
    }

    return NextResponse.json({reply:reply||'(sem resposta)',provider:prov,tools_used:used,iterations:iters});
  }catch(e){
    return NextResponse.json({reply:`❌ ${e.message}`,error:e.message},{status:200});
  }
}

export async function GET(){
  return NextResponse.json({
    ok:true,
    daniela:'V16 com tools + sessões persistentes',
    default:OAI?'openai gpt-4.1-mini':GK?'groq llama-3.3-70b':'cohere',
    chain:[OAI&&'openai',GK&&'groq',GEK&&'gemini',CHK&&'cohere'].filter(Boolean),
    tools:TOOLS.length,
    stats,
    sessions_supported:!!SBK,
  });
}
