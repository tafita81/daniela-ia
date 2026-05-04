// @ts-nocheck
// V19 — chat_sessions (schema correto) + GPT-4.1-mini com nova chave + tudo funcional
import{NextResponse}from'next/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;

const OAI=process.env.OPENAI_API_KEY||'';
const GK=process.env.GROQ_API_KEY||'';
const GEK=process.env.GEMINI_API_KEY||'';
const GH_PAT=process.env.GH_PAT||'';
const VT=process.env.VERCEL_TOKEN||'';
const TEAM=process.env.VERCEL_TEAM_ID||'team_zr9vAef0Zz3njNAiGm3v5Y3h';
const SBU=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://tpjvalzwkqwttvmszvie.supabase.co';
const SBK=process.env.SUPABASE_SERVICE_KEY||'';

const TOOLS=[
{type:'function',function:{name:'web_search',description:'Pesquisa web via DuckDuckGo',parameters:{type:'object',properties:{query:{type:'string'}},required:['query']}}},
{type:'function',function:{name:'web_fetch',description:'Baixa conteúdo de URL',parameters:{type:'object',properties:{url:{type:'string'}},required:['url']}}},
{type:'function',function:{name:'github_read',description:'Lê arquivo GitHub',parameters:{type:'object',properties:{repo:{type:'string'},path:{type:'string'}},required:['repo','path']}}},
{type:'function',function:{name:'github_list',description:'Lista arquivos GitHub',parameters:{type:'object',properties:{repo:{type:'string'},path:{type:'string'}},required:['repo','path']}}},
{type:'function',function:{name:'github_write',description:'Cria/edita arquivo GitHub (Vercel auto-deploya em ~90s)',parameters:{type:'object',properties:{repo:{type:'string'},path:{type:'string'},content:{type:'string'},message:{type:'string'}},required:['repo','path','content','message']}}},
{type:'function',function:{name:'vercel_deploy_status',description:'Estado deploy Vercel',parameters:{type:'object',properties:{project_id:{type:'string'}},required:['project_id']}}},
{type:'function',function:{name:'vercel_envs',description:'Lista env vars',parameters:{type:'object',properties:{project_id:{type:'string'}},required:['project_id']}}},
{type:'function',function:{name:'vercel_set_env',description:'Cria/atualiza env var sensitive',parameters:{type:'object',properties:{project_id:{type:'string'},key:{type:'string'},value:{type:'string'}},required:['project_id','key','value']}}},
{type:'function',function:{name:'supabase_sql',description:'Executa SQL no Supabase',parameters:{type:'object',properties:{sql:{type:'string'}},required:['sql']}}},
{type:'function',function:{name:'health_check',description:'Health dos provedores',parameters:{type:'object',properties:{}}}},
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
      const r=await fetch(`https://api.github.com/repos/${args.repo}/contents/${args.path}`,{headers:{Authorization:`token ${GH_PAT}`}});
      if(!r.ok)return`erro: HTTP ${r.status}`;
      const d=await r.json();
      const c=Buffer.from(d.content||'','base64').toString('utf-8');
      return JSON.stringify({path:d.path,sha:d.sha,size:d.size,content:c.substring(0,8000)});
    }
    if(name==='github_list'){
      const r=await fetch(`https://api.github.com/repos/${args.repo}/contents/${args.path}`,{headers:{Authorization:`token ${GH_PAT}`}});
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
      const r=await fetch(`https://api.vercel.com/v6/deployments?projectId=${args.project_id}&teamId=${TEAM}&limit=1`,{headers:{Authorization:`Bearer ${VT}`}});
      const d=(await r.json()).deployments?.[0];
      return d?`Estado: ${d.state} | URL: https://${d.url} | ${(d.meta?.githubCommitMessage||'?').substring(0,80)}`:'sem deploys';
    }
    if(name==='vercel_envs'){
      const r=await fetch(`https://api.vercel.com/v9/projects/${args.project_id}/env?teamId=${TEAM}`,{headers:{Authorization:`Bearer ${VT}`}});
      return JSON.stringify((await r.json()).envs?.map(e=>({key:e.key,target:e.target}))||[]);
    }
    if(name==='vercel_set_env'){
      const r=await fetch(`https://api.vercel.com/v10/projects/${args.project_id}/env?teamId=${TEAM}&upsert=true`,
        {method:'POST',headers:{Authorization:`Bearer ${VT}`,'Content-Type':'application/json'},
        body:JSON.stringify({key:args.key,value:args.value,type:'sensitive',target:['production','preview']})});
      return r.ok?`✅ ${args.key} setado`:`❌ ${(await r.json()).error?.message||'erro'}`;
    }
    if(name==='supabase_sql'){
      // Read-only via PostgREST RPC seria mais limpo; pra MVP usa execute via REST com tabela específica
      return 'use as APIs específicas (chat_sessions etc) ou peça para o admin executar SQL via MCP';
    }
    if(name==='health_check'){
      return JSON.stringify({openai:!!OAI,groq:!!GK,gemini:!!GEK,supabase:!!SBK});
    }
    return`tool desconhecida: ${name}`;
  }catch(e){return`erro: ${e.message.substring(0,200)}`;}
}

async function callOpenAI(messages,tools){
  const r=await fetch('https://api.openai.com/v1/chat/completions',{
    method:'POST',headers:{Authorization:`Bearer ${OAI}`,'Content-Type':'application/json'},
    body:JSON.stringify({model:'gpt-4.1-mini',messages,...(tools&&{tools,tool_choice:'auto'}),max_tokens:2000,temperature:0.7})});
  if(!r.ok){const e=await r.json();throw new Error(`openai_${r.status}: ${(e.error?.message||'').substring(0,150)}`);}
  const d=await r.json();
  return{provider:'openai',message:d.choices[0].message,usage:d.usage};
}

async function callGroq(messages,tools){
  const cleanMsgs=messages.map(m=>{
    if(Array.isArray(m.content)){return{...m,content:m.content.filter(c=>c.type==='text').map(c=>c.text).join(' ')||'(imagem omitida)'};}
    return m;
  });
  const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{
    method:'POST',headers:{Authorization:`Bearer ${GK}`,'Content-Type':'application/json'},
    body:JSON.stringify({model:'llama-3.3-70b-versatile',messages:cleanMsgs,...(tools&&{tools,tool_choice:'auto'}),max_tokens:2000,temperature:0.6})});
  if(!r.ok){const e=await r.json();throw new Error(`groq_${r.status}: ${(e.error?.message||'').substring(0,150)}`);}
  const d=await r.json();
  return{provider:'groq',message:d.choices[0].message,usage:d.usage};
}

async function callGemini(messages){
  const sys=messages.find(m=>m.role==='system')?.content||'';
  const sysText=typeof sys==='string'?sys:JSON.stringify(sys);
  const contents=messages.filter(m=>m.role!=='system'&&m.role!=='tool').map(m=>{
    const parts=[];
    if(Array.isArray(m.content)){
      for(const c of m.content){
        if(c.type==='text')parts.push({text:c.text});
        else if(c.type==='image_url'&&c.image_url?.url?.startsWith('data:')){
          const[meta,b64]=c.image_url.url.split(',');
          const mime=meta.match(/data:([^;]+)/)?.[1]||'image/png';
          parts.push({inlineData:{mimeType:mime,data:b64}});
        }
      }
    }else{parts.push({text:typeof m.content==='string'?m.content:JSON.stringify(m.content||'')});}
    return{role:m.role==='assistant'?'model':'user',parts};
  }).filter(c=>c.parts.length);
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEK}`,
    {method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({systemInstruction:{parts:[{text:sysText}]},contents,generationConfig:{maxOutputTokens:2000,temperature:0.6}})});
  if(!r.ok){const e=await r.json();throw new Error(`gemini_${r.status}: ${(e.error?.message||'').substring(0,150)}`);}
  const d=await r.json();
  return{provider:'gemini',message:{role:'assistant',content:d.candidates?.[0]?.content?.parts?.[0]?.text||''}};
}

async function aiCall(messages,withTools){
  const errors=[];
  if(OAI){try{return await callOpenAI(messages,withTools?TOOLS:undefined);}catch(e){errors.push(e.message);}}
  if(GK){try{return await callGroq(messages,withTools?TOOLS:undefined);}catch(e){errors.push(e.message);}}
  if(GEK){try{return await callGemini(messages);}catch(e){errors.push(e.message);}}
  throw new Error(`falhas: ${errors.join(' | ').substring(0,400)}`);
}

// ── chat_sessions table (schema correto) ──────────────────────────────────
async function sbSaveSession(id,user_id,title,messages,provider){
  if(!SBK)return false;
  try{
    const r=await fetch(`${SBU}/rest/v1/chat_sessions`,{
      method:'POST',headers:{apikey:SBK,Authorization:`Bearer ${SBK}`,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'},
      body:JSON.stringify({id,user_id:user_id||'anon',title:(title||'Chat').substring(0,200),messages,provider,msg_count:messages.length,updated_at:new Date().toISOString()})});
    return r.ok;
  }catch{return false;}
}
async function sbGetSession(id){
  if(!SBK)return null;
  try{
    const r=await fetch(`${SBU}/rest/v1/chat_sessions?id=eq.${encodeURIComponent(id)}`,{headers:{apikey:SBK,Authorization:`Bearer ${SBK}`}});
    if(!r.ok)return null;
    const d=await r.json();return d?.[0]||null;
  }catch{return null;}
}
async function sbListSessions(user_id,limit=50){
  if(!SBK)return[];
  try{
    const r=await fetch(`${SBU}/rest/v1/chat_sessions?user_id=eq.${encodeURIComponent(user_id||'anon')}&order=updated_at.desc&limit=${limit}&select=id,title,msg_count,provider,updated_at`,
      {headers:{apikey:SBK,Authorization:`Bearer ${SBK}`}});
    if(!r.ok)return[];
    return await r.json();
  }catch{return[];}
}
async function sbDeleteSession(id){
  if(!SBK)return false;
  try{
    const r=await fetch(`${SBU}/rest/v1/chat_sessions?id=eq.${encodeURIComponent(id)}`,{method:'DELETE',headers:{apikey:SBK,Authorization:`Bearer ${SBK}`}});
    return r.ok;
  }catch{return false;}
}

const SYS=`Você é Daniela Coelho — agente IA EXECUTORA do projeto psicologia.doc V19.

⚡ FERRAMENTAS REAIS DISPONÍVEIS (USE-AS):
• web_search, web_fetch — pesquisar/baixar
• github_read, github_list, github_write — ler/escrever código (Vercel auto-deploya em ~90s)
• vercel_deploy_status, vercel_envs, vercel_set_env — gerenciar Vercel
• health_check — saúde dos provedores

🎯 REPOS:
• tafita81/daniela-ia (prj_WLapekXHxYLOyylLGqTycwufKTVT) → daniela-ia.vercel.app
• tafita81/Repovazio (prj_rypXLpuS41CQt7sQYk5MM8kRQArr) → repovazio.vercel.app

⚠️ REGRAS ABSOLUTAS:
1. Quando pedirem AÇÕES ("configure", "deploy", "edite", "verifique"), VOCÊ EXECUTA usando tools.
2. NUNCA diga "não tenho acesso" ou "não consigo executar". Use tools.
3. NUNCA invente arquivos/commits — só fale o que veio das tools.
4. Após cada tool: reporte resultado real.
5. Imagens/PDFs/arquivos: descreva e analise o conteúdo passado no contexto.
6. PT-BR direto, técnico.`;

export async function POST(req){
  try{
    const body=await req.json();

    if(body._action==='session_save'&&body._session_id){
      const ok=await sbSaveSession(body._session_id,body._user_id,body._title,body.messages||[],null);
      return NextResponse.json({ok});
    }
    if(body._action==='sessions_list'){
      const sessions=await sbListSessions(body._user_id||'anon');
      return NextResponse.json({ok:true,sessions});
    }
    if(body._action==='session_load'&&body._session_id){
      return NextResponse.json({ok:true,session:await sbGetSession(body._session_id)});
    }
    if(body._action==='session_delete'&&body._session_id){
      return NextResponse.json({ok:await sbDeleteSession(body._session_id)});
    }

    const userMsgs=Array.isArray(body.messages)?body.messages:[];

    // Vision (data URL imagem)
    if(body.image&&userMsgs.length>0){
      const last=userMsgs[userMsgs.length-1];
      if(last.role==='user'){
        last.content=[
          {type:'text',text:typeof last.content==='string'?last.content:'Analise esta imagem'},
          {type:'image_url',image_url:{url:body.image}}
        ];
      }
    }

    // Files (PDF/ZIP/code/docs)
    if(body.fileContent&&body.fileName){
      const fname=body.fileName.toLowerCase();
      const sz=body.fileSize?(body.fileSize/1024).toFixed(0)+'KB':'';
      let note='';
      if(fname.endsWith('.zip'))note=`[📦 ZIP ${body.fileName} ${sz} — não consigo extrair, descreva o conteúdo]`;
      else if(fname.endsWith('.pdf'))note=`[📄 PDF ${body.fileName} ${sz}]\n\n--- CONTEÚDO EXTRAÍDO ---\n${typeof body.fileContent==='string'?body.fileContent.substring(0,10000):'(binário)'}`;
      else if(fname.match(/\.(txt|md|js|ts|jsx|tsx|json|csv|html|xml|yaml|yml|env|sh|py|java|c|cpp|rs|go|rb|php|sql)$/))
        note=`[📎 ${body.fileName} ${sz}]\n\n--- CONTEÚDO ---\n${body.fileContent.substring(0,15000)}`;
      else if(fname.match(/\.(docx|doc)$/))note=`[📄 DOC ${body.fileName} ${sz}]\n\n${typeof body.fileContent==='string'?body.fileContent.substring(0,10000):'(binário, peça PDF)'}`;
      else note=`[📎 ${body.fileName} ${sz}]\n${typeof body.fileContent==='string'?body.fileContent.substring(0,5000):''}`;
      if(userMsgs.length>0&&userMsgs[userMsgs.length-1].role==='user'){
        const last=userMsgs[userMsgs.length-1];
        if(typeof last.content==='string')last.content=last.content+'\n\n'+note;
        else if(Array.isArray(last.content))last.content.push({type:'text',text:note});
      }
    }

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
      reply=typeof message.content==='string'?message.content:JSON.stringify(message.content||'');
      break;
    }

    if(body.session_id){
      const allMsgs=[...userMsgs.map(m=>({role:m.role,content:typeof m.content==='string'?m.content:(Array.isArray(m.content)?m.content.find(c=>c.type==='text')?.text||'(arquivo)':String(m.content))})),
                     {role:'assistant',content:reply}];
      const title=allMsgs[0]?.content?.substring(0,80)||'Chat';
      sbSaveSession(body.session_id,body.user_id||'anon',title,allMsgs,prov).catch(()=>{});
    }

    return NextResponse.json({reply:reply||'(sem resposta)',provider:prov,tools_used:used,iterations:iters});
  }catch(e){
    return NextResponse.json({reply:`❌ ${e.message}`,error:e.message},{status:200});
  }
}

export async function GET(){
  return NextResponse.json({
    ok:true,
    daniela:'V19 — chat_sessions + GPT-4.1-mini default + chave nova OK',
    default:OAI?'gpt-4.1-mini':GK?'groq':GEK?'gemini':'none',
    chain:[OAI&&'openai gpt-4.1-mini ✓',GK&&'groq llama-3.3-70b ✓',GEK&&'gemini-2.0-flash ✓'].filter(Boolean),
    tools_count:TOOLS.length,
    sessions_supported:!!SBK,
    capabilities:['vision','file analysis (pdf/zip/code/docx)','tool calling','auto deploy via github_write','sessions persistentes'],
  });
}
