// @ts-nocheck
// app/api/chat/route.js — Daniela executa tarefas reais com tools
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
const SBU=process.env.NEXT_PUBLIC_SUPABASE_URL||'';
const SBK=process.env.SUPABASE_SERVICE_KEY||'';

// ── TOKEN COUNTER (proativo a 80%) ──────────────────────────────────────
let tokenStats={
  openai:{used:0,limit:200000,reset:Date.now()+86400000},
  groq:{used:0,limit:14400,reset:Date.now()+86400000},
  cohere:{used:0,limit:166666,reset:Date.now()+86400000},
  gemini:{used:0,limit:1500,reset:Date.now()+86400000},
};
const SWITCH=0.80;
function bump(prov,n=1){if(tokenStats[prov]){tokenStats[prov].used+=n;if(Date.now()>tokenStats[prov].reset){tokenStats[prov].used=0;tokenStats[prov].reset=Date.now()+86400000;}}}
function pct(prov){const s=tokenStats[prov];return s?s.used/s.limit:0;}
function pickProvider(){
  if(OAI&&pct('openai')<SWITCH)return'openai';
  if(GK&&pct('groq')<SWITCH)return'groq';
  if(CHK&&pct('cohere')<SWITCH)return'cohere';
  if(GEK&&pct('gemini')<SWITCH)return'gemini';
  if(TGK)return'together';
  return'cohere';
}

// ── TOOLS QUE A DANIELA PODE EXECUTAR ────────────────────────────────────
const TOOLS=[
  {type:'function',function:{name:'web_search',description:'Pesquisa na web e retorna resultados',parameters:{type:'object',properties:{query:{type:'string'}},required:['query']}}},
  {type:'function',function:{name:'web_fetch',description:'Baixa conteúdo de URL',parameters:{type:'object',properties:{url:{type:'string'}},required:['url']}}},
  {type:'function',function:{name:'github_read',description:'Lê arquivo do GitHub (repo formato owner/name)',parameters:{type:'object',properties:{repo:{type:'string'},path:{type:'string'}},required:['repo','path']}}},
  {type:'function',function:{name:'github_write',description:'Escreve/cria/edita arquivo no GitHub e faz commit',parameters:{type:'object',properties:{repo:{type:'string'},path:{type:'string'},content:{type:'string'},message:{type:'string'}},required:['repo','path','content','message']}}},
  {type:'function',function:{name:'github_list',description:'Lista arquivos de um diretório no GitHub',parameters:{type:'object',properties:{repo:{type:'string'},path:{type:'string'}},required:['repo','path']}}},
  {type:'function',function:{name:'vercel_deploy',description:'Verifica último deploy do projeto Vercel (re-deploy automático ao commitar)',parameters:{type:'object',properties:{project_id:{type:'string'}},required:['project_id']}}},
  {type:'function',function:{name:'vercel_logs',description:'Retorna logs runtime do deploy Vercel',parameters:{type:'object',properties:{project_id:{type:'string'}},required:['project_id']}}},
  {type:'function',function:{name:'vercel_envs',description:'Lista env vars de um projeto Vercel',parameters:{type:'object',properties:{project_id:{type:'string'}},required:['project_id']}}},
  {type:'function',function:{name:'vercel_set_env',description:'Cria ou atualiza env var no Vercel',parameters:{type:'object',properties:{project_id:{type:'string'},key:{type:'string'},value:{type:'string'},target:{type:'string',enum:['production','preview','development']}},required:['project_id','key','value']}}},
  {type:'function',function:{name:'supabase_sql',description:'Executa SQL no Supabase via REST',parameters:{type:'object',properties:{table:{type:'string'},select:{type:'string'},limit:{type:'number'}},required:['table']}}},
  {type:'function',function:{name:'health_check',description:'Verifica saúde de todos os conectores em tempo real',parameters:{type:'object',properties:{}}}},
];

// ── EXECUÇÃO DAS TOOLS ────────────────────────────────────────────────────
async function execTool(name,args){
  try{
    switch(name){
      case'web_search':{
        const r=await fetch(`https://duckduckgo.com/html?q=${encodeURIComponent(args.query)}`,{headers:{'User-Agent':'Mozilla/5.0'}});
        const html=await r.text();
        const results=[];
        const re=/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
        let m;while((m=re.exec(html))&&results.length<5)results.push({url:m[1],title:m[2]});
        return JSON.stringify({query:args.query,results});
      }
      case'web_fetch':{
        const r=await fetch(args.url,{headers:{'User-Agent':'Mozilla/5.0'}});
        const t=await r.text();
        return t.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').substring(0,4000);
      }
      case'github_read':{
        const r=await fetch(`https://api.github.com/repos/${args.repo}/contents/${args.path}`,
          {headers:{Authorization:`token ${GH_PAT}`,Accept:'application/vnd.github.v3+json'}});
        if(!r.ok)return`erro: HTTP ${r.status}`;
        const d=await r.json();
        const content=Buffer.from(d.content,'base64').toString('utf-8');
        return JSON.stringify({path:d.path,sha:d.sha,size:d.size,content:content.substring(0,8000)});
      }
      case'github_list':{
        const r=await fetch(`https://api.github.com/repos/${args.repo}/contents/${args.path}`,
          {headers:{Authorization:`token ${GH_PAT}`}});
        if(!r.ok)return`erro: HTTP ${r.status}`;
        const d=await r.json();
        return JSON.stringify(Array.isArray(d)?d.map(f=>({name:f.name,type:f.type,size:f.size})):d);
      }
      case'github_write':{
        const url=`https://api.github.com/repos/${args.repo}/contents/${args.path}`;
        const exist=await fetch(url,{headers:{Authorization:`token ${GH_PAT}`}});
        const body={message:args.message,content:Buffer.from(args.content).toString('base64')};
        if(exist.ok){const ed=await exist.json();body.sha=ed.sha;}
        const r=await fetch(url,{method:'PUT',headers:{Authorization:`token ${GH_PAT}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
        const d=await r.json();
        return r.ok?`✅ Commit ${d.commit?.sha?.substring(0,7)} em ${args.repo}/${args.path}`:`❌ ${d.message}`;
      }
      case'vercel_deploy':{
        const r=await fetch(`https://api.vercel.com/v6/deployments?projectId=${args.project_id}&teamId=${TEAM}&limit=1`,
          {headers:{Authorization:`Bearer ${VT}`}});
        const d=await r.json();
        const dep=d.deployments?.[0];
        return dep?`Estado: ${dep.state} | URL: https://${dep.url} | Commit: ${dep.meta?.githubCommitMessage||'?'}`:'sem deploys';
      }
      case'vercel_logs':{
        const dr=await fetch(`https://api.vercel.com/v6/deployments?projectId=${args.project_id}&teamId=${TEAM}&limit=1`,
          {headers:{Authorization:`Bearer ${VT}`}});
        const dep=(await dr.json()).deployments?.[0];
        if(!dep)return'sem deploy';
        const r=await fetch(`https://api.vercel.com/v3/deployments/${dep.uid}/events?teamId=${TEAM}&limit=20`,
          {headers:{Authorization:`Bearer ${VT}`}});
        const events=await r.json();
        return JSON.stringify(events.slice(-10).map(e=>({type:e.type,text:(e.payload?.text||'').substring(0,200)})));
      }
      case'vercel_envs':{
        const r=await fetch(`https://api.vercel.com/v9/projects/${args.project_id}/env?teamId=${TEAM}`,
          {headers:{Authorization:`Bearer ${VT}`}});
        const d=await r.json();
        return JSON.stringify((d.envs||[]).map(e=>({key:e.key,target:e.target,type:e.type})));
      }
      case'vercel_set_env':{
        const r=await fetch(`https://api.vercel.com/v10/projects/${args.project_id}/env?teamId=${TEAM}&upsert=true`,
          {method:'POST',headers:{Authorization:`Bearer ${VT}`,'Content-Type':'application/json'},
          body:JSON.stringify({key:args.key,value:args.value,type:'encrypted',target:[args.target||'production']})});
        const d=await r.json();
        return r.ok?`✅ ${args.key} setado em ${args.project_id}`:`❌ ${d.error?.message||JSON.stringify(d)}`;
      }
      case'supabase_sql':{
        const q=args.select?`select=${args.select}`:'select=*';
        const lim=args.limit?`&limit=${args.limit}`:'&limit=10';
        const r=await fetch(`${SBU}/rest/v1/${args.table}?${q}${lim}`,
          {headers:{apikey:SBK,Authorization:`Bearer ${SBK}`}});
        return r.ok?JSON.stringify(await r.json()).substring(0,3000):`erro: ${r.status}`;
      }
      case'health_check':{
        const r=await fetch(`${process.env.VERCEL_URL?'https://'+process.env.VERCEL_URL:'http://localhost:3000'}/api/health`);
        return r.ok?JSON.stringify(await r.json()).substring(0,2000):'health offline';
      }
      default:return`tool desconhecida: ${name}`;
    }
  }catch(e){return`erro executando ${name}: ${e.message.substring(0,150)}`;}
}

// ── PROVEDORES IA COM TOOL CALLING ────────────────────────────────────────
async function callOpenAI(messages,tools){
  if(!OAI)throw new Error('no_openai_key');
  const r=await fetch('https://api.openai.com/v1/chat/completions',{
    method:'POST',
    headers:{Authorization:`Bearer ${OAI}`,'Content-Type':'application/json'},
    body:JSON.stringify({model:'gpt-4.1-mini',messages,tools,tool_choice:'auto',max_tokens:2000,temperature:0.7})
  });
  if(!r.ok){const e=await r.json();throw new Error(`openai_${r.status}: ${e.error?.message||''}`);}
  const d=await r.json();bump('openai',d.usage?.total_tokens||100);
  return{provider:'openai',model:'gpt-4.1-mini',message:d.choices[0].message,usage:d.usage};
}

async function callGroq(messages,tools){
  if(!GK)throw new Error('no_groq_key');
  const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{
    method:'POST',
    headers:{Authorization:`Bearer ${GK}`,'Content-Type':'application/json'},
    body:JSON.stringify({model:'llama-3.3-70b-versatile',messages,tools,tool_choice:'auto',max_tokens:2000,temperature:0.7})
  });
  if(!r.ok){const e=await r.json();throw new Error(`groq_${r.status}: ${e.error?.message||''}`);}
  const d=await r.json();bump('groq',1);
  return{provider:'groq',model:'llama-3.3-70b',message:d.choices[0].message,usage:d.usage};
}

async function callCohere(messages){
  if(!CHK)throw new Error('no_cohere_key');
  const r=await fetch('https://api.cohere.com/v2/chat',{
    method:'POST',
    headers:{Authorization:`Bearer ${CHK}`,'Content-Type':'application/json'},
    body:JSON.stringify({model:'command-r-08-2024',messages,max_tokens:2000,temperature:0.7})
  });
  if(!r.ok){const e=await r.json();throw new Error(`cohere_${r.status}: ${e.message||''}`);}
  const d=await r.json();bump('cohere',d.meta?.tokens?.output_tokens||100);
  const text=d.message?.content?.[0]?.text||'';
  return{provider:'cohere',model:'command-r',message:{role:'assistant',content:text},usage:d.meta?.tokens};
}

async function aiCall(messages,tools){
  const order=['openai','groq','cohere'];
  let lastErr=null;
  for(const prov of order){
    if(prov==='openai'&&!OAI)continue;
    if(prov==='groq'&&!GK)continue;
    if(prov==='cohere'&&!CHK)continue;
    if(pct(prov)>=SWITCH){lastErr=`${prov} >${Math.round(SWITCH*100)}%`;continue;}
    try{
      if(prov==='openai')return await callOpenAI(messages,tools);
      if(prov==='groq')return await callGroq(messages,tools);
      if(prov==='cohere')return await callCohere(messages);
    }catch(e){lastErr=e.message;continue;}
  }
  throw new Error(lastErr||'todos provedores falharam');
}

// ── SYSTEM PROMPT — DANIELA EXECUTA, NÃO SÓ FALA ─────────────────────────
const SYS=`Você é Daniela Coelho — agente IA EXECUTORA do projeto psicologia.doc V14.

VOCÊ TEM ACESSO REAL A FERRAMENTAS:
- web_search, web_fetch — pesquisar e baixar páginas
- github_read, github_write, github_list — ler/escrever código (commit direto)
- vercel_deploy, vercel_logs, vercel_envs, vercel_set_env — gerenciar deploys
- supabase_sql — consultar banco
- health_check — verificar conectores

REPOSITÓRIOS:
- tafita81/daniela-ia (prj_WLapekXHxYLOyylLGqTycwufKTVT) → https://daniela-ia.vercel.app
- tafita81/Repovazio (prj_rypXLpuS41CQt7sQYk5MM8kRQArr) → https://repovazio.vercel.app

REGRAS:
1. Quando o usuário pedir "configure X", "deploy Y", "verifique Z" — VOCÊ EXECUTA usando tools.
2. NUNCA diga "não tenho acesso" — use as tools.
3. Vercel auto-redeploya quando você commita no GitHub. Para deployar = github_write + vercel_deploy (verificar).
4. Após cada ação importante, reporte: "✅ feito X" ou "❌ erro Y, vou tentar Z".
5. Responda em português brasileiro, tom direto e técnico.
6. Para tarefas complexas: planeje em 1 linha → execute em sequência → reporte resultados.`;

// ── HANDLER POST PRINCIPAL ────────────────────────────────────────────────
export async function POST(req){
  try{
    const body=await req.json();
    const userMsgs=Array.isArray(body.messages)?body.messages:[];
    const messages=[{role:'system',content:SYS},...userMsgs];

    // Loop de execução de tools (até 8 iterações)
    let iters=0;const usedTools=[];let finalReply='';let lastProvider='';
    while(iters<8){
      iters++;
      const{provider,model,message,usage}=await aiCall(messages,TOOLS);
      lastProvider=provider;

      if(message.tool_calls&&message.tool_calls.length){
        messages.push(message);
        for(const tc of message.tool_calls){
          let args={};try{args=JSON.parse(tc.function.arguments||'{}');}catch{}
          const result=await execTool(tc.function.name,args);
          usedTools.push({name:tc.function.name,args});
          messages.push({role:'tool',tool_call_id:tc.id,content:result.substring(0,4000)});
        }
        continue;
      }
      finalReply=message.content||'';
      break;
    }

    return NextResponse.json({
      reply:finalReply||'(sem resposta)',
      provider:lastProvider,
      tools_used:usedTools,
      iterations:iters,
      stats:{
        openai:{pct:Math.round(pct('openai')*100),used:tokenStats.openai.used},
        groq:{pct:Math.round(pct('groq')*100),used:tokenStats.groq.used},
        cohere:{pct:Math.round(pct('cohere')*100),used:tokenStats.cohere.used},
      }
    });
  }catch(e){
    return NextResponse.json({reply:`❌ erro: ${e.message}`,error:e.message},{status:200});
  }
}

export async function GET(){
  return NextResponse.json({
    ok:true,
    daniela:'V15 com tools reais',
    default_provider:OAI?'openai gpt-4.1-mini':GK?'groq llama-3.3-70b':'cohere command-r',
    chain:[OAI&&'openai',GK&&'groq',CHK&&'cohere',GEK&&'gemini',TGK&&'together'].filter(Boolean),
    tools_count:TOOLS.length,
    stats:tokenStats,
  });
}
