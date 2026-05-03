// @ts-nocheck
// V17 — Daniela executa tools (Groq primário, OpenAI quando válido, Cohere SÓ sem tools)
import{NextResponse}from'next/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;

const OAI=process.env.OPENAI_API_KEY||'';
const GK=process.env.GROQ_API_KEY||'';
const GEK=process.env.GEMINI_API_KEY||'';
const CHK=process.env.COHERE_API_KEY||'';
const GH_PAT=process.env.GH_PAT||'';
const VT=process.env.VERCEL_TOKEN||'';
const TEAM=process.env.VERCEL_TEAM_ID||'team_zr9vAef0Zz3njNAiGm3v5Y3h';
const SBU=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://tpjvalzwkqwttvmszvie.supabase.co';
const SBK=process.env.SUPABASE_SERVICE_KEY||'';

// Provedores que falharam recentemente — pula nas próximas chamadas (5min cooldown)
const failed=new Map();
function markFail(p,why){failed.set(p,{at:Date.now(),why});}
function isFailed(p){const f=failed.get(p);return f&&Date.now()-f.at<300000;}

// ── TOOLS QUE A DANIELA EXECUTA ──────────────────────────────────────────
const TOOLS=[
{type:'function',function:{name:'web_search',description:'Pesquisa web via DuckDuckGo',parameters:{type:'object',properties:{query:{type:'string'}},required:['query']}}},
{type:'function',function:{name:'web_fetch',description:'Baixa conteúdo de URL pública',parameters:{type:'object',properties:{url:{type:'string'}},required:['url']}}},
{type:'function',function:{name:'github_read',description:'Lê arquivo do GitHub. repo no formato owner/name',parameters:{type:'object',properties:{repo:{type:'string'},path:{type:'string'}},required:['repo','path']}}},
{type:'function',function:{name:'github_list',description:'Lista arquivos de diretório GitHub',parameters:{type:'object',properties:{repo:{type:'string'},path:{type:'string'}},required:['repo','path']}}},
{type:'function',function:{name:'github_write',description:'Cria/edita arquivo no GitHub e faz commit (Vercel auto-deploya)',parameters:{type:'object',properties:{repo:{type:'string'},path:{type:'string'},content:{type:'string'},message:{type:'string'}},required:['repo','path','content','message']}}},
{type:'function',function:{name:'vercel_deploy_status',description:'Estado do último deploy Vercel do projeto',parameters:{type:'object',properties:{project_id:{type:'string'}},required:['project_id']}}},
{type:'function',function:{name:'vercel_envs',description:'Lista env vars do projeto',parameters:{type:'object',properties:{project_id:{type:'string'}},required:['project_id']}}},
{type:'function',function:{name:'vercel_set_env',description:'Cria/atualiza env var (criptografada)',parameters:{type:'object',properties:{project_id:{type:'string'},key:{type:'string'},value:{type:'string'}},required:['project_id','key','value']}}},
{type:'function',function:{name:'health_check',description:'Health de todos provedores e conectores',parameters:{type:'object',properties:{}}}},
];

async function execTool(name,args){
  try{
    if(name==='web_search'){
      const r=await fetch(`https://duckduckgo.com/html?q=${encodeURIComponent(args.query)}`,{headers:{'User-Agent':'Mozilla/5.0'}});
      const html=await r.text();const out=[];const re=/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
      let m;while((m=re.exec(html))&&out.length<5)out.push({url:m[1],title:m[2]});
      return JSON.stringify({results:out});
    }
    if(name==='web_fetch'){
      const r=await fetch(args.url,{headers:{'User-Agent':'Mozilla/5.0'}});
      return(await r.text()).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').substring(0,4000);
    }
    if(name==='github_read'){
      const r=await fetch(`https://api.github.com/repos/${args.repo}/contents/${args.path}`,
        {headers:{Authorization:`token ${GH_PAT}`}});
      if(!r.ok)return`erro: HTTP ${r.status}`;
      const d=await r.json();
      const c=Buffer.from(d.content||'','base64').toString('utf-8');
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
      return r.ok?`✅ commit ${d.commit?.sha?.substring(0,7)} em ${args.repo}/${args.path}`:`❌ ${d.message}`;
    }
    if(name==='vercel_deploy_status'){
      const r=await fetch(`https://api.vercel.com/v6/deployments?projectId=${args.project_id}&teamId=${TEAM}&limit=1`,
        {headers:{Authorization:`Bearer ${VT}`}});
      const d=(await r.json()).deployments?.[0];
      return d?`Estado: ${d.state} | URL: https://${d.url} | Commit: ${(d.meta?.githubCommitMessage||'?').substring(0,80)}`:'sem deploys';
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
        body:JSON.stringify({key:args.key,value:args.value,type:'sensitive',target:['production','preview']})});
      const d=await r.json();
      return r.ok?`✅ ${args.key} setado`:`❌ ${d.error?.message||JSON.stringify(d).substring(0,200)}`;
    }
    if(name==='health_check'){
      return JSON.stringify({openai:!isFailed('openai'),groq:!isFailed('groq'),gemini:!isFailed('gemini'),cohere:!isFailed('cohere')});
    }
    return`tool desconhecida: ${name}`;
  }catch(e){return`erro: ${e.message.substring(0,150)}`;}
}

// ── PROVEDORES ────────────────────────────────────────────────────────────
async function callOpenAI(messages,tools){
  const r=await fetch('https://api.openai.com/v1/chat/completions',{
    method:'POST',headers:{Authorization:`Bearer ${OAI}`,'Content-Type':'application/json'},
    body:JSON.stringify({model:'gpt-4.1-mini',messages,...(tools&&{tools,tool_choice:'auto'}),max_tokens:2000,temperature:0.7})});
  if(!r.ok){const e=await r.json();throw new Error(`openai_${r.status}:${(e.error?.message||'').substring(0,100)}`);}
  const d=await r.json();
  return{provider:'openai',model:'gpt-4.1-mini',message:d.choices[0].message};
}

async function callGroq(messages,tools){
  const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{
    method:'POST',headers:{Authorization:`Bearer ${GK}`,'Content-Type':'application/json'},
    body:JSON.stringify({model:'llama-3.3-70b-versatile',messages,...(tools&&{tools,tool_choice:'auto'}),max_tokens:2000,temperature:0.6})});
  if(!r.ok){const e=await r.json();throw new Error(`groq_${r.status}:${(e.error?.message||'').substring(0,100)}`);}
  const d=await r.json();
  return{provider:'groq',model:'llama-3.3-70b',message:d.choices[0].message};
}

async function callGemini(messages){
  const sys=messages.find(m=>m.role==='system')?.content||'';
  const contents=messages.filter(m=>m.role!=='system'&&m.role!=='tool').map(m=>({
    role:m.role==='assistant'?'model':'user',
    parts:[{text:typeof m.content==='string'?m.content:JSON.stringify(m.content||'')}]
  })).filter(c=>c.parts[0].text);
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEK}`,
    {method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({systemInstruction:{parts:[{text:sys}]},contents,generationConfig:{maxOutputTokens:2000,temperature:0.6}})});
  if(!r.ok){const e=await r.json();throw new Error(`gemini_${r.status}:${(e.error?.message||'').substring(0,100)}`);}
  const d=await r.json();
  return{provider:'gemini',model:'gemini-2.0-flash',message:{role:'assistant',content:d.candidates?.[0]?.content?.parts?.[0]?.text||''}};
}

// IMPORTANT: chain CORRETA — Groq primeiro, OpenAI tenta apenas se válido, Gemini fallback, Cohere FORA quando há tools
async function aiCall(messages,withTools){
  let last=null;
  // Groq primeiro — supports tool calling, é estável
  if(GK&&!isFailed('groq')){
    try{return await callGroq(messages,withTools?TOOLS:undefined);}
    catch(e){last=e.message;markFail('groq',e.message);}
  }
  // OpenAI segundo — só se key válida (falha rápido se 401/429)
  if(OAI&&!isFailed('openai')){
    try{return await callOpenAI(messages,withTools?TOOLS:undefined);}
    catch(e){last=e.message;markFail('openai',e.message);}
  }
  // Gemini terceiro — tools não funcionam aqui mas pode responder texto
  if(GEK&&!isFailed('gemini')&&!withTools){
    try{return await callGemini(messages);}catch(e){last=e.message;markFail('gemini',e.message);}
  }
  // Sem fallback Cohere se withTools (alucina) — só usa se tudo falhou e não tem tools
  if(GEK&&!isFailed('gemini')&&withTools){
    try{return await callGemini(messages);}catch(e){last=e.message;markFail('gemini',e.message);}
  }
  throw new Error(`todos provedores falharam: ${last||'?'}`);
}

// ── SESSÕES VIA SUPABASE ────────────────────────────────────────────────
async function sbSet(key,value){
  if(!SBK)return false;
  try{
    const r=await fetch(`${SBU}/rest/v1/ia_cache`,{
      method:'POST',
      headers:{apikey:SBK,Authorization:`Bearer ${SBK}`,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'},
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
const SYS=`Você é Daniela Coelho — agente IA EXECUTORA do projeto psicologia.doc V17.

⚡ VOCÊ TEM ACESSO REAL A FERRAMENTAS QUE EXECUTAM:
• web_search, web_fetch — pesquisar/baixar conteúdo
• github_read, github_list, github_write — ler/escrever código (commit direto)
• vercel_deploy_status, vercel_envs, vercel_set_env — gerenciar Vercel
• health_check — verificar provedores

🎯 REPOS:
• tafita81/daniela-ia (prj_WLapekXHxYLOyylLGqTycwufKTVT) → daniela-ia.vercel.app
• tafita81/Repovazio (prj_rypXLpuS41CQt7sQYk5MM8kRQArr) → repovazio.vercel.app

⚠️ REGRAS ABSOLUTAS:
1. Quando o usuário pedir ações ("configure", "deploy", "verifique", "edite", "liste"), VOCÊ EXECUTA usando as tools disponíveis. Sempre.
2. NUNCA diga "não tenho acesso" ou "não consigo fazer". USE AS TOOLS.
3. NUNCA invente arquivos, commits, conteúdo ou resultados. Só fale o que de fato veio das tools.
4. Após cada tool: reporte resultado real "✅ feito X (commit abc1234)" ou "❌ erro Y, vou tentar Z".
5. github_write commita → Vercel auto-deploya em ~90s. Use vercel_deploy_status pra confirmar.
6. Português brasileiro, direto, técnico, sem floreio.`;

// ── HANDLER ───────────────────────────────────────────────────────────────
export async function POST(req){
  try{
    const body=await req.json();

    // Ações de sessão
    if(body._action==='session_save'&&body._session_id){
      const key=`chat:${body._user_id||'anon'}:${body._session_id}`;
      await sbSet(key,{title:body._title||'Chat',msgs:body.messages||[],updated_at:new Date().toISOString()});
      return NextResponse.json({ok:true,saved:key});
    }
    if(body._action==='sessions_list'){
      const list=await sbList(`chat:${body._user_id||'anon'}:`,50);
      return NextResponse.json({ok:true,sessions:list.map(s=>({
        id:s.key.split(':').pop(),
        title:s.value?.title||'Chat',
        updated_at:s.updated_at,
        msg_count:s.value?.msgs?.length||0
      }))});
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

    let iters=0,used=[],reply='',prov='';
    while(iters<8){
      iters++;
      const{provider,message}=await aiCall(messages,true);
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

    // Auto-save da sessão
    if(body.session_id){
      const allMsgs=[...userMsgs,{role:'assistant',content:reply}];
      const title=userMsgs[0]?.content?.substring(0,60)||'Chat';
      sbSet(`chat:${body.user_id||'anon'}:${body.session_id}`,
        {title,msgs:allMsgs,updated_at:new Date().toISOString(),provider:prov}).catch(()=>{});
    }

    return NextResponse.json({reply:reply||'(sem resposta)',provider:prov,tools_used:used,iterations:iters});
  }catch(e){
    return NextResponse.json({reply:`❌ ${e.message}`,error:e.message},{status:200});
  }
}

export async function GET(){
  return NextResponse.json({
    ok:true,
    daniela:'V17 — tools + sessões persistentes + Groq primário',
    chain:[
      GK&&!isFailed('groq')?'groq llama-3.3-70b ✓':null,
      OAI&&!isFailed('openai')?'openai gpt-4.1-mini':null,
      GEK&&!isFailed('gemini')?'gemini-2.0-flash':null,
    ].filter(Boolean),
    failed:Array.from(failed.entries()).map(([p,f])=>({p,why:f.why.substring(0,80),ago_s:Math.round((Date.now()-f.at)/1000)})),
    tools_count:TOOLS.length,
    sessions_supported:!!SBK,
  });
}
