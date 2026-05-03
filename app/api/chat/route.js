// @ts-nocheck
// app/api/chat/route.js — DANIELA V15 — Claude Code parity: GitHub+Vercel+Supabase+Self-Optimize
import{NextResponse}from'next/server';
export const runtime='nodejs';
export const maxDuration=60;

const GK=process.env.GROQ_API_KEY,GEK=process.env.GEMINI_API_KEY;
const PAT=process.env.GH_PAT,SBU=process.env.NEXT_PUBLIC_SUPABASE_URL,SBK=process.env.SUPABASE_SERVICE_KEY;
const VTK=process.env.VERCEL_TOKEN,VTM=process.env.VERCEL_TEAM_ID||'team_zr9vAef0Zz3njNAiGm3v5Y3h';
const REPO='tafita81/Repovazio',VER='V15-ULTRA-2026-05-03';


// ── TOKEN MONITORING & MULTI-MODEL FALLBACK ─────────────────────────────
// Limits per model (daily for Groq free, per-minute for others)
// ── TOGETHER AI ─────────────────────────────────────────────────────────
const TGK=process.env.TOGETHER_API_KEY||'';
async function togetherCall(msgs){
  if(!TGK)return null;
  try{
    const cleanMsgs=msgs.filter(m=>m.role!=='tool'&&!m.tool_calls).map(m=>({role:m.role,content:String(m.content||'...')}));
    const r=await fetch('https://api.together.xyz/v1/chat/completions',{method:'POST',
      headers:{Authorization:`Bearer ${TGK}`,'Content-Type':'application/json'},
      body:JSON.stringify({model:'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',messages:cleanMsgs,max_tokens:1000,temperature:0.7}),
      signal:AbortSignal.timeout(25000)});
    const d=await r.json();
    if(!r.ok)return null;
    return d.choices?.[0]?.message?.content||null;
  }catch(e){return null;}
}

// ── PROVIDER CHAIN com reset times ──────────────────────────────────────
// resetType: 'daily_utc' = reseta meia-noite UTC, 'daily_pt' = meia-noite PT (8h UTC), 'monthly' = 1º do mês, 'credits' = por crédito
// ── CADEIA OTIMIZADA POR QUALIDADE + COBERTURA ────────────────────────────
// Estratégia: melhor modelo primeiro, depois fallbacks com reset independente
// Groq 3.3 e 3.1 compartilham o MESMO limite diário (mesmo GK)
// Por isso Gemini/Together/Cohere entram antes de usar Groq 3.1
const MODEL_CHAIN=[
  // 🦙 #1 — MELHOR QUALIDADE: Groq Llama 3.3 70B (100k tokens/dia)
  {name:'llama-3.3-70b-versatile',provider:'groq',limit:100000,key:()=>GK,resetType:'daily_utc',emoji:'🦙',label:'Llama 3.3 70B'},
  // ✨ #2 — FALLBACK RÁPIDO: Gemini 2.0 Flash (reset independente, 8h depois do Groq)
  {name:'gemini-2.0-flash',provider:'gemini',limit:50000,key:()=>GEK,resetType:'daily_pt',emoji:'✨',label:'Gemini 2.0'},
  // 🔷 #3 — FALLBACK SEPARADO: Together AI (provider completamente diferente)
  {name:'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',provider:'together',limit:1000000,key:()=>TGK,resetType:'credits',emoji:'🔷',label:'Together Turbo'},
  // 🟡 #4 — RESERVA ENORME: Cohere (5M tokens/mês ≈ 167k/dia efetivos!)
  {name:'command-r-08-2024',provider:'cohere',limit:5000000,key:()=>CHK,resetType:'monthly',emoji:'🟡',label:'Cohere Command-R'},
  // 🦙 #5 — RASPAGEM FINAL: Groq 3.1 (tokens restantes do mesmo pool Groq)
  {name:'llama-3.1-8b-instant',provider:'groq',limit:100000,key:()=>GK,resetType:'daily_utc',emoji:'🦙',label:'Llama 3.1 8B'},
];
const SWITCH_THRESHOLD=0.88; // switch a 88% (conservador para não desperdiçar)

// Calcula tempo de reset para cada provider em ms
function getResetTimeMs(resetType){
  const now=new Date();
  if(resetType==='daily_utc'){
    const next=new Date(now);next.setUTCHours(24,0,0,0);return next.getTime()-now.getTime();
  }
  if(resetType==='daily_pt'){
    // PT = UTC-8, então reseta às 8h UTC
    const next=new Date(now);
    const h=now.getUTCHours();
    if(h<8)next.setUTCHours(8,0,0,0);
    else{next.setUTCDate(next.getUTCDate()+1);next.setUTCHours(8,0,0,0);}
    return next.getTime()-now.getTime();
  }
  if(resetType==='monthly'){
    const next=new Date(now.getFullYear(),now.getMonth()+1,1,0,0,0,0);
    return next.getTime()-now.getTime();
  }
  return 3600000; // credits: assume 1h
}

function formatTimeLeft(ms){
  if(ms<=0)return'disponível agora';
  const h=Math.floor(ms/3600000);const m=Math.floor((ms%3600000)/60000);
  if(h>24)return`${Math.floor(h/24)}d ${h%24}h`;
  if(h>0)return`${h}h ${m}min`;
  return`${m}min`;
}

async function getTokenState(){
  if(!SBU||!SBK)return{model:'llama-3.3-70b-versatile',used:0,limit:100000,chain_idx:0};
  try{
    const r=await fetch(`${SBU}/rest/v1/ia_cache?cache_key=eq.token_state&select=value`,
      {headers:{apikey:SBK,Authorization:`Bearer ${SBK}`}});
    const d=await r.json();
    if(d[0]?.value)return JSON.parse(d[0].value);
  }catch(e){}
  return{model:'llama-3.3-70b-versatile',used:0,limit:100000,chain_idx:0,last_reset:Date.now()};
}

async function saveTokenState(state){
  if(!SBU||!SBK)return;
  const val=JSON.stringify({...state,updated_at:Date.now()});
  await fetch(`${SBU}/rest/v1/ia_cache`,{method:'POST',
    headers:{apikey:SBK,Authorization:`Bearer ${SBK}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates'},
    body:JSON.stringify({cache_key:'token_state',value:val,expires_at:new Date(Date.now()+7*864e5).toISOString()})}).catch(()=>{});
}

async function updateTokenUsage(tokensEstimate){
  const state=await getTokenState();
  state.used=(state.used||0)+tokensEstimate;
  const m=MODEL_CHAIN[state.chain_idx||0];
  
  // Auto-reset: verifica se já passou o tempo de reset do provider atual
  if(m&&state.last_reset){
    const resetMs=getResetTimeMs(m.resetType||'daily_utc');
    const timeSinceReset=Date.now()-(state.last_reset||0);
    const fullCycle=86400000; // 24h
    if(m.resetType==='daily_utc'&&timeSinceReset>fullCycle){
      // Reset do Groq! volta ao início
      state.chain_idx=0;state.model=MODEL_CHAIN[0].name;state.provider=MODEL_CHAIN[0].provider;
      state.used=tokensEstimate;state.last_reset=Date.now();
      state.switch_event=`♻️ Auto-reset Groq diário — voltando ao modelo principal`;
    }
  }
  
  // Proactive switch a 85%
  const curr=MODEL_CHAIN[state.chain_idx||0];
  if(curr&&state.used>=(curr.limit*SWITCH_THRESHOLD)){
    // Calcular reset times de todos os providers para escolher o melhor
    const providerResets=MODEL_CHAIN.map((mm,i)=>({
      idx:i, name:mm.name, provider:mm.provider,
      resetMs:getResetTimeMs(mm.resetType||'daily_utc'),
      available:i!==state.chain_idx
    }));
    
    // Tenta próximo na cadeia primeiro
    let nextIdx=(state.chain_idx+1)%MODEL_CHAIN.length;
    const next=MODEL_CHAIN[nextIdx];
    
    // Salva reset time do provider atual para monitoramento
    const resetMsAtSwitch=getResetTimeMs(curr.resetType||'daily_utc');
    
    state.chain_idx=nextIdx;
    state.model=next.name;
    state.provider=next.provider;
    state.used=0;
    state.last_reset=Date.now();
    state.switched_at=new Date().toISOString();
    state.switch_event=`⚡ ${curr.label||curr.name.split('/').pop()} → ${next.label||next.name.split('/').pop()} | Reset ${curr.provider} em ${formatTimeLeft(resetMsAtSwitch)}`;
    
    // Guardar reset times de todos os providers
    state.provider_resets=providerResets.map(p=>({
      provider:p.provider, name:p.name.split('/').pop(),
      reset_in:formatTimeLeft(p.resetMs), reset_ms:p.resetMs
    }));
  }
  
  // Se chegou ao fim da cadeia, encontra o que vai resetar primeiro
  if(state.chain_idx===MODEL_CHAIN.length-1&&state.used>=(MODEL_CHAIN[state.chain_idx].limit*SWITCH_THRESHOLD)){
    const earliest=MODEL_CHAIN.reduce((best,mm,i)=>{
      const ms=getResetTimeMs(mm.resetType||'daily_utc');
      return(!best||ms<best.ms)?{idx:i,ms,provider:mm.provider,name:mm.name}:best;
    },null);
    if(earliest){
      state.chain_idx=earliest.idx;
      state.model=earliest.name;
      state.provider=earliest.provider;
      state.used=0;state.last_reset=Date.now();
      state.switch_event=`♾️ Ciclo completo! Retomando ${earliest.name.split('/').pop()} (resetou ${formatTimeLeft(earliest.ms)})`;
    }
  }
  
  await saveTokenState(state);
  return state;
}

async function saveCheckpoint(msgs,state){
  if(!SBU||!SBK)return;
  const checkpoint={
    msgs:msgs.slice(-10), // last 10 messages
    model:state.model,
    ts:Date.now(),
    summary:msgs[msgs.length-1]?.content?.substring(0,200)||''
  };
  await fetch(`${SBU}/rest/v1/ia_cache`,{method:'POST',
    headers:{apikey:SBK,Authorization:`Bearer ${SBK}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates'},
    body:JSON.stringify({cache_key:'conversation_checkpoint',value:JSON.stringify(checkpoint),expires_at:new Date(Date.now()+2*864e5).toISOString()})}).catch(()=>{});
}

async function getActiveModel(requestedModel){
  const state=await getTokenState();
  const chainModel=MODEL_CHAIN[state.chain_idx||0];
  return{
    model:requestedModel||state.model||chainModel.name,
    provider:state.provider||chainModel.provider,
    chain_idx:state.chain_idx||0,
    tokens_used:state.used||0,
    tokens_limit:chainModel?.limit||100000,
    switched_at:state.switched_at||null,
    switch_event:state.switch_event||null,
  };
}

const TOOLS=[
  // ── WEB ──
  {type:'function',function:{name:'pesquisar_web',description:'Pesquisa na internet em tempo real',parameters:{type:'object',properties:{query:{type:'string'},num:{type:'number'}},required:['query']}}},
  {type:'function',function:{name:'web_fetch',description:'Busca conteúdo completo de URL',parameters:{type:'object',properties:{url:{type:'string'}},required:['url']}}},
  {type:'function',function:{name:'browser_agent',description:'Agente autônomo: navega, clica, preenche forms, extrai dados de sites',parameters:{type:'object',properties:{acao:{type:'string',enum:['navegar','clicar_link','preencher_formulario','extrair_dados']},url:{type:'string'},dados:{type:'object'}},required:['acao','url']}}},
  // ── CÓDIGO ──
  {type:'function',function:{name:'executar_codigo',description:'Executa código Python/JS/TS/Rust/Go/Bash e retorna output real',parameters:{type:'object',properties:{linguagem:{type:'string'},codigo:{type:'string'},stdin:{type:'string'}},required:['linguagem','codigo']}}},
  {type:'function',function:{name:'gerar_imagem',description:'Gera imagem com IA a partir de descrição',parameters:{type:'object',properties:{descricao:{type:'string'},largura:{type:'number'},altura:{type:'number'}},required:['descricao']}}},
  {type:'function',function:{name:'analisar_imagem',description:'Analisa conteúdo de imagem via URL',parameters:{type:'object',properties:{url:{type:'string'},pergunta:{type:'string'}},required:['url']}}},
  // ── GITHUB (Claude Code core) ──
  {type:'function',function:{name:'github_read_file',description:'Lê arquivo do GitHub. Use para inspecionar código antes de editar.',parameters:{type:'object',properties:{path:{type:'string'},repo:{type:'string'}},required:['path']}}},
  {type:'function',function:{name:'github_write_file',description:'Cria/atualiza arquivo no GitHub. Dispara deploy Vercel automático. Use para self-optimize ou criar features.',parameters:{type:'object',properties:{path:{type:'string'},content:{type:'string'},message:{type:'string'},repo:{type:'string'}},required:['path','content','message']}}},
  {type:'function',function:{name:'github_list_dir',description:'Lista todos os arquivos/pastas de um diretório do repo. Use antes de ler/editar para saber o que existe.',parameters:{type:'object',properties:{path:{type:'string'},repo:{type:'string'}},required:['path']}}},
  {type:'function',function:{name:'github_delete_file',description:'Deleta arquivo do GitHub',parameters:{type:'object',properties:{path:{type:'string'},message:{type:'string'},repo:{type:'string'}},required:['path','message']}}},
  {type:'function',function:{name:'github_create_repo',description:'Cria novo repositório GitHub do zero para um novo app',parameters:{type:'object',properties:{nome:{type:'string'},descricao:{type:'string'},privado:{type:'boolean'}},required:['nome']}}},
  // ── VERCEL (Claude Code core) ──
  {type:'function',function:{name:'vercel_deploy_status',description:'Status dos últimos deploys Vercel: READY, BUILDING, ERROR e logs de erro',parameters:{type:'object',properties:{projeto:{type:'string'}},required:[]}}},
  {type:'function',function:{name:'vercel_get_logs',description:'Logs de runtime do Vercel para debug de erros em produção',parameters:{type:'object',properties:{projeto:{type:'string'},limite:{type:'number'}},required:[]}}},
  {type:'function',function:{name:'vercel_set_env',description:'Adiciona/atualiza env var no Vercel (GROQ_API_KEY, etc)',parameters:{type:'object',properties:{chave:{type:'string'},valor:{type:'string'},projeto:{type:'string'}},required:['chave','valor']}}},
  {type:'function',function:{name:'vercel_criar_projeto',description:'Cria novo projeto Vercel e conecta a um repo GitHub existente',parameters:{type:'object',properties:{nome:{type:'string'},repo_github:{type:'string'}},required:['nome','repo_github']}}},
  // ── SUPABASE ──
  {type:'function',function:{name:'supabase_sql',description:'Executa SQL no Supabase: CREATE TABLE, INSERT, UPDATE, SELECT, DELETE',parameters:{type:'object',properties:{sql:{type:'string'}},required:['sql']}}},
  // ── MEMÓRIA ──
  {type:'function',function:{name:'memoria_salvar',description:'Salva info na memória persistente (Supabase)',parameters:{type:'object',properties:{chave:{type:'string'},valor:{type:'string'}},required:['chave','valor']}}},
  {type:'function',function:{name:'memoria_carregar',description:'Carrega info da memória persistente',parameters:{type:'object',properties:{chave:{type:'string'}},required:['chave']}}},
  // ── APP CREATION ──
  {type:'function',function:{name:'criar_novo_app',description:'Cria app Next.js completo do zero: cria repo GitHub + estrutura de arquivos + conecta Vercel. Use quando o usuário pedir um novo app/projeto.',parameters:{type:'object',properties:{nome:{type:'string'},descricao:{type:'string'},tipo:{type:'string',enum:['nextjs','landing-page','dashboard','api','blog']}},required:['nome','descricao']}}},
  // ── STATUS ──

  // ── MULTI-CONTA & SETTINGS ──────────────────────────────────────────
  {type:'function',function:{name:'settings_save',description:'Salva tokens/APIs das contas no banco. Use quando usuário inserir novos tokens.',parameters:{type:'object',properties:{service:{type:'string'},tokens:{type:'string'},extra:{type:'string'}},required:['service','tokens']}}},
  {type:'function',function:{name:'settings_load',description:'Carrega tokens/APIs configurados pelo usuário',parameters:{type:'object',properties:{service:{type:'string'}},required:[]}}},
  // ── NOTION ──────────────────────────────────────────────────────────
  {type:'function',function:{name:'notion_search',description:'Busca páginas e conteúdo no Notion do usuário',parameters:{type:'object',properties:{query:{type:'string'},database_id:{type:'string'}},required:['query']}}},
  {type:'function',function:{name:'notion_write',description:'Cria ou atualiza página no Notion (memória, notas, tarefas)',parameters:{type:'object',properties:{title:{type:'string'},content:{type:'string'},database_id:{type:'string'},page_id:{type:'string'}},required:['title','content']}}},
  // ── VOZ ─────────────────────────────────────────────────────────────
  {type:'function',function:{name:'elevenlabs_tts',description:'Converte texto em áudio real via ElevenLabs (voz Daniela)',parameters:{type:'object',properties:{text:{type:'string'},voice_id:{type:'string'}},required:['text']}}},
  // ── AUTO-UPDATE ──────────────────────────────────────────────────────
  {type:'function',function:{name:'check_updates',description:'Verifica novidades do Claude AI e features novas para incorporar',parameters:{type:'object',properties:{}}}},
  // ── CANVA ────────────────────────────────────────────────────────────
  {type:'function',function:{name:'canva_create',description:'Cria design no Canva (posts, thumbnails, carrosséis)',parameters:{type:'object',properties:{tipo:{type:'string',enum:['post','thumbnail','apresentacao','stories','email']},descricao:{type:'string'},titulo:{type:'string'}},required:['tipo','descricao']}}},
  {type:'function',function:{name:'projeto_status',description:'Status completo do projeto psicologia.doc e do sistema',parameters:{type:'object',properties:{}}}},
];

async function runTool(name,args,ctx={}){
  try{
    // ── WEB ──────────────────────────────────────────────────────────────
    if(name==='pesquisar_web'){
      const q=encodeURIComponent(args.query),num=args.num||5;
      const r=await fetch(`https://html.duckduckgo.com/html/?q=${q}&kl=pt-br`,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(10000)});
      const html=await r.text();
      const results=[];const rx=/<a class="result__a" href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([^<]*)<\/a>/g;
      let m,c=0;while((m=rx.exec(html))&&c<num){const url=m[1].split('&')[0];if(url.startsWith('http')){results.push(`**${m[2].trim()}**\n${url}\n${m[3].trim()}`);c++;}}
      return results.length?`🔍 **${args.query}:**\n\n${results.join('\n\n---\n\n')}`:`❌ Sem resultados`;
    }
    if(name==='web_fetch'){
      const r=await fetch(args.url,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(15000)});
      if(!r.ok)return`❌ HTTP ${r.status}`;
      return`🌐 **${args.url}**\n\n${(await r.text()).replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().substring(0,6000)}`;
    }
    if(name==='browser_agent'){
      const{acao,url,dados}=args,ua='Mozilla/5.0 Chrome/120';
      if(acao==='navegar'||acao==='extrair_dados'){
        const r=await fetch(url,{headers:{'User-Agent':ua},signal:AbortSignal.timeout(20000)});
        if(!r.ok)return`❌ HTTP ${r.status}`;
        const html=await r.text();
        const links=[];const lr=/<a[^>]+href="([^"]+)"[^>]*>([^<]{1,60})<\/a>/gi;
        let lm;while((lm=lr.exec(html))&&links.length<8){try{const h=lm[1].startsWith('http')?lm[1]:new URL(lm[1],url).href;links.push(`[${lm[2].trim()}](${h})`);}catch(e){}}
        const clean=html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().substring(0,4000);
        return`🤖 **${url}**\n\n${clean}\n\n**Links:**\n${links.join('\n')}`;
      }
      if(acao==='preencher_formulario'&&dados){
        const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':ua},body:new URLSearchParams(dados).toString(),signal:AbortSignal.timeout(20000)});
        return`📝 **POST → ${url}** (${r.status})\n\n${(await r.text()).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().substring(0,3000)}`;
      }
      if(acao==='clicar_link'){const r=await fetch(url,{headers:{'User-Agent':ua},signal:AbortSignal.timeout(15000)});return`🖱️ **→ ${url}**\n\n${(await r.text()).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().substring(0,4000)}`;}
    }

    // ── CÓDIGO ───────────────────────────────────────────────────────────
    if(name==='executar_codigo'){
      const lm={python:'python',py:'python',javascript:'javascript',js:'javascript',typescript:'typescript',ts:'typescript',rust:'rust',go:'go',bash:'bash',sh:'bash',cpp:'c++'};
      const lang=lm[args.linguagem?.toLowerCase()]||args.linguagem||'python';
      const r=await fetch('https://emkc.org/api/v2/piston/execute',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({language:lang,version:'*',files:[{content:args.codigo}],stdin:args.stdin||''}),signal:AbortSignal.timeout(30000)});
      const d=await r.json();
      return`⚡ **${lang}:**\n\`\`\`\n${d.run?.output||d.compile?.output||'(sem output)'}\`\`\`${d.run?.stderr?`\n❌\`\`\`\n${d.run.stderr}\`\`\``:''}`;
    }
    if(name==='gerar_imagem'){
      const url=`https://image.pollinations.ai/prompt/${encodeURIComponent(args.descricao)}?width=${args.largura||1024}&height=${args.altura||1024}&seed=${Math.floor(Math.random()*99999)}&nologo=true&enhance=true`;
      return`🎨 ![${args.descricao}](${url})`;
    }
    if(name==='analisar_imagem'&&GEK){
      const r=await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${GEK}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{inline_data:{mime_type:'image/jpeg',data:args.url.replace(/^data:image\/\w+;base64,/,'')}},{text:args.pergunta||'Descreva'}]}]})});
      const d=await r.json();return`👁️ ${d.candidates?.[0]?.content?.parts?.[0]?.text||'Erro'}`;
    }

    // ── GITHUB ───────────────────────────────────────────────────────────
    if(name==='github_read_file'){
      const repo=args.repo||REPO;
      const r=await fetch(`https://api.github.com/repos/${repo}/contents/${args.path}`,{headers:{Authorization:`token ${PAT}`,Accept:'application/vnd.github.v3+json'}});
      if(!r.ok)return`❌ Não encontrado: ${args.path} (${r.status})`;
      const d=await r.json();
      const content=Buffer.from(d.content,'base64').toString('utf8');
      return`📄 **${args.path}** (${d.size}b, SHA:${d.sha.substring(0,8)})\n\`\`\`\n${content.substring(0,10000)}\n\`\`\``;
    }
    if(name==='github_list_dir'){
      const repo=args.repo||REPO,path=args.path||'';
      const r=await fetch(`https://api.github.com/repos/${repo}/contents/${path}`,{headers:{Authorization:`token ${PAT}`,Accept:'application/vnd.github.v3+json'}});
      if(!r.ok)return`❌ Erro ao listar ${path}: ${r.status}`;
      const items=await r.json();
      if(!Array.isArray(items))return`❌ Não é um diretório`;
      const tree=items.map(i=>`${i.type==='dir'?'📁':'📄'} ${i.name}${i.type==='file'?` (${i.size}b)`:''}`).join('\n');
      return`📁 **${path||'/'}** (${items.length} items)\n${tree}`;
    }
    if(name==='github_write_file'){
      const repo=args.repo||REPO;
      let sha;const c=await fetch(`https://api.github.com/repos/${repo}/contents/${args.path}`,{headers:{Authorization:`token ${PAT}`,Accept:'application/vnd.github.v3+json'}});
      if(c.ok)sha=(await c.json()).sha;
      const body={message:args.message||`feat: update ${args.path}`,content:Buffer.from(args.content,'utf8').toString('base64')};if(sha)body.sha=sha;
      const r=await fetch(`https://api.github.com/repos/${repo}/contents/${args.path}`,{method:'PUT',headers:{Authorization:`token ${PAT}`,Accept:'application/vnd.github.v3+json','Content-Type':'application/json'},body:JSON.stringify(body)});
      const rd=await r.json();if(!r.ok)throw new Error(JSON.stringify(rd).substring(0,200));
      return`✅ **Commitado:** \`${args.path}\`\nSHA: ${rd.commit?.sha?.substring(0,10)}\n🚀 Deploy Vercel disparado automaticamente (~40s para ficar live)`;
    }
    if(name==='github_delete_file'){
      const repo=args.repo||REPO;
      const c=await fetch(`https://api.github.com/repos/${repo}/contents/${args.path}`,{headers:{Authorization:`token ${PAT}`,Accept:'application/vnd.github.v3+json'}});
      if(!c.ok)return`❌ Arquivo não encontrado`;
      const sha=(await c.json()).sha;
      const r=await fetch(`https://api.github.com/repos/${repo}/contents/${args.path}`,{method:'DELETE',headers:{Authorization:`token ${PAT}`,Accept:'application/vnd.github.v3+json','Content-Type':'application/json'},body:JSON.stringify({message:args.message||`delete: ${args.path}`,sha})});
      return r.ok?`✅ Deletado: \`${args.path}\``:`❌ Erro: ${r.status}`;
    }
    if(name==='github_create_repo'){
      const r=await fetch('https://api.github.com/user/repos',{method:'POST',headers:{Authorization:`token ${PAT}`,Accept:'application/vnd.github.v3+json','Content-Type':'application/json'},body:JSON.stringify({name:args.nome,description:args.descricao||'',private:args.privado||false,auto_init:true})});
      if(r.status===422)return`⚠️ Repo "${args.nome}" já existe`;
      const d=await r.json();if(!r.ok)return`❌ Erro: ${JSON.stringify(d).substring(0,200)}`;
      return`✅ **Repo criado:** ${d.html_url}\nClone: \`${d.clone_url}\``;
    }

    // ── VERCEL ───────────────────────────────────────────────────────────
    if(name==='vercel_deploy_status'){
      const prjId='prj_rypXLpuS41CQt7sQYk5MM8kRQArr';
      const r=await fetch(`https://api.vercel.com/v6/deployments?projectId=${prjId}&teamId=${VTM}&limit=5`,{headers:{Authorization:`Bearer ${VTK||''}`,Accept:'application/json'}});
      if(!r.ok)return`❌ Vercel API ${r.status}. Configure VERCEL_TOKEN no Vercel env vars.`;
      const d=await r.json();
      const deploys=d.deployments?.map(dep=>{
        const state=dep.state;
        const icon=state==='READY'?'✅':state==='ERROR'?'❌':state==='BUILDING'?'⚙️':'⏸️';
        return`${icon} ${state} | ${dep.meta?.githubCommitMessage?.substring(0,50)||'N/A'} | ${new Date(dep.created).toLocaleString('pt-BR')}`;
      }).join('\n')||'Nenhum deploy';
      return`🚀 **Últimos deploys:**\n${deploys}`;
    }
    if(name==='vercel_get_logs'){
      const prjId='prj_rypXLpuS41CQt7sQYk5MM8kRQArr';
      const r=await fetch(`https://api.vercel.com/v1/projects/${prjId}/edge-config?teamId=${VTM}`,{headers:{Authorization:`Bearer ${VTK||''}`}});
      if(!r.ok)return`❌ Vercel API ${r.status}. Configure VERCEL_TOKEN.`;
      return`📋 Configure VERCEL_TOKEN e use vercel_deploy_status para ver status. Para logs de runtime, acesse vercel.com/tafita81s-projects/repovazio/logs`;
    }
    if(name==='vercel_set_env'){
      if(!VTK)return`❌ Configure VERCEL_TOKEN como env var no Vercel primeiro.`;
      const prjId='prj_rypXLpuS41CQt7sQYk5MM8kRQArr';
      const r=await fetch(`https://api.vercel.com/v10/projects/${prjId}/env?teamId=${VTM}`,{method:'POST',headers:{Authorization:`Bearer ${VTK}`,'Content-Type':'application/json'},body:JSON.stringify({key:args.chave,value:args.valor,type:'encrypted',target:['production','preview']})});
      const d=await r.json();
      return r.ok?`✅ Env var **${args.chave}** configurada no Vercel.`:`❌ Erro: ${JSON.stringify(d).substring(0,200)}`;
    }
    if(name==='vercel_criar_projeto'){
      if(!VTK)return`❌ Configure VERCEL_TOKEN. Então posso criar projetos Vercel automaticamente.`;
      const r=await fetch(`https://api.vercel.com/v10/projects?teamId=${VTM}`,{method:'POST',headers:{Authorization:`Bearer ${VTK}`,'Content-Type':'application/json'},body:JSON.stringify({name:args.nome,gitRepository:{type:'github',repo:args.repo_github}})});
      const d=await r.json();
      return r.ok?`✅ **Projeto Vercel criado:** ${args.nome}\nID: ${d.id}\nURL: ${d.alias?.[0]||args.nome+'.vercel.app'}`:`❌ ${JSON.stringify(d).substring(0,200)}`;
    }

    // ── SUPABASE ─────────────────────────────────────────────────────────
    if(name==='supabase_sql'){
      if(!SBU||!SBK)return`❌ Supabase não configurado`;
      const r=await fetch(`${SBU}/functions/v1/exec-sql`,{method:'POST',headers:{Authorization:`Bearer ${SBK}`,'Content-Type':'application/json'},body:JSON.stringify({sql:args.sql})});
      const d=await r.json();
      return d.error?`❌ SQL erro: ${d.error}`:`✅ SQL OK:\n\`\`\`json\n${JSON.stringify(d.data,null,2).substring(0,2000)}\n\`\`\``;
    }

    // ── MEMÓRIA ──────────────────────────────────────────────────────────
    if(name==='memoria_salvar'){
      if(!SBU||!SBK)return`❌ Supabase não configurado`;
      await fetch(`${SBU}/rest/v1/ia_cache`,{method:'POST',headers:{apikey:SBK,Authorization:`Bearer ${SBK}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates'},body:JSON.stringify({cache_key:`mem_${args.chave}`,value:args.valor.substring(0,2000),expires_at:new Date(Date.now()+90*864e5).toISOString()})});
      return`✅ Memória salva: "${args.chave}"`;
    }
    if(name==='memoria_carregar'){
      if(!SBU||!SBK)return`❌ Supabase não configurado`;
      const r=await fetch(`${SBU}/rest/v1/ia_cache?cache_key=eq.mem_${args.chave}&select=value`,{headers:{apikey:SBK,Authorization:`Bearer ${SBK}`}});
      const d=await r.json();return d[0]?.value?`💾 **${args.chave}:** ${d[0].value}`:`❌ Não encontrado`;
    }

    // ── CRIAR NOVO APP ────────────────────────────────────────────────────
    if(name==='criar_novo_app'){
      const{nome,descricao,tipo='nextjs'}=args;
      // 1. Criar repo
      const rr=await fetch('https://api.github.com/user/repos',{method:'POST',headers:{Authorization:`token ${PAT}`,Accept:'application/vnd.github.v3+json','Content-Type':'application/json'},body:JSON.stringify({name:nome,description:descricao,private:false,auto_init:false})});
      const rd=await rr.json();if(!rr.ok&&rr.status!==422)return`❌ Erro ao criar repo: ${JSON.stringify(rd).substring(0,200)}`;

      // 2. Create package.json
      const pkg=JSON.stringify({name:nome.toLowerCase(),version:'0.1.0',private:true,scripts:{dev:'next dev',build:'next build',start:'next start'},dependencies:{'next':'14.2.29','react':'18','react-dom':'18'},devDependencies:{}},'',2);
      const commit=async(path,content,msg='init')=>{
        const b64=Buffer.from(content,'utf8').toString('base64');
        await fetch(`https://api.github.com/repos/tafita81/${nome}/contents/${path}`,{method:'PUT',headers:{Authorization:`token ${PAT}`,Accept:'application/vnd.github.v3+json','Content-Type':'application/json'},body:JSON.stringify({message:msg,content:b64})});
      };
      await commit('package.json',pkg,'feat: init Next.js app');
      await commit('app/layout.js',`export const metadata={title:'${nome}'};export default function Root({children}){return(<html lang="pt-BR"><body>{children}</body></html>)}`,'feat: layout');
      await commit('app/page.js',`export default function Home(){return(<main style={{padding:40,fontFamily:'sans-serif'}}><h1>${nome}</h1><p>${descricao}</p></main>)}`,'feat: homepage');

      // 3. Criar projeto Vercel se token disponível
      let vercelMsg='Configure VERCEL_TOKEN para auto-deploy.';
      if(VTK){
        const vr=await fetch(`https://api.vercel.com/v10/projects?teamId=${VTM}`,{method:'POST',headers:{Authorization:`Bearer ${VTK}`,'Content-Type':'application/json'},body:JSON.stringify({name:nome,gitRepository:{type:'github',repo:`tafita81/${nome}`}})});
        const vd=await vr.json();
        if(vr.ok)vercelMsg=`✅ Vercel: https://${nome}.vercel.app`;
      }
      return`🚀 **App criado com sucesso!**\n\n📁 GitHub: https://github.com/tafita81/${nome}\n🌐 ${vercelMsg}\n\nPróximo passo: peça para eu adicionar features ao app!`;
    }

    if(name==='projeto_status'){
      return`🚀 **psicologia.doc ${VER}**\nDeploy: repovazio.vercel.app\nGitHub: tafita81/Repovazio\nCron: a cada 1min → /api/cerebro\nTools: ${TOOLS.length}\nDia: 15/261 (revelação: 31/12/2026)\nCapacidades: self-optimize, criar apps, GitHub CRUD, Vercel API, Supabase SQL`;
    }


    // ── SETTINGS ──────────────────────────────────────────────────────────
    if(name==='settings_save'){
      if(!SBU||!SBK)return`❌ Supabase não configurado`;
      const key=`cfg_${args.service||'global'}`;
      const val=JSON.stringify({tokens:args.tokens,extra:args.extra||'',ts:Date.now()});
      await fetch(`${SBU}/rest/v1/ia_cache`,{method:'POST',headers:{apikey:SBK,Authorization:`Bearer ${SBK}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates'},body:JSON.stringify({cache_key:key,value:val,expires_at:new Date(Date.now()+365*864e5).toISOString()})});
      return`✅ Configuração de **${args.service}** salva. Tokens armazenados de forma segura.`;
    }
    if(name==='settings_load'){
      if(!SBU||!SBK)return`❌ Supabase não configurado`;
      const svc=args.service||'global';
      const r=await fetch(`${SBU}/rest/v1/ia_cache?cache_key=eq.cfg_${svc}&select=value`,{headers:{apikey:SBK,Authorization:`Bearer ${SBK}`}});
      const d=await r.json();
      if(!d[0])return`ℹ️ Nenhuma configuração salva para "${svc}". Adicione tokens nas Configurações (⚙️).`;
      const cfg=JSON.parse(d[0].value);
      return`✅ Config **${svc}**: ${cfg.tokens?'tokens configurados':'sem tokens'} | Salvo: ${new Date(cfg.ts).toLocaleString('pt-BR')}`;
    }

    // ── NOTION ─────────────────────────────────────────────────────────────
    if(name==='notion_search'||name==='notion_write'){
      // Get Notion token from Supabase settings
      let ntk='';
      if(SBU&&SBK){const r=await fetch(`${SBU}/rest/v1/ia_cache?cache_key=eq.cfg_notion&select=value`,{headers:{apikey:SBK,Authorization:`Bearer ${SBK}`}});const d=await r.json();if(d[0])try{ntk=JSON.parse(d[0].value).tokens||'';}catch(e){}}
      if(!ntk)return`❌ Notion não configurado. Vá em ⚙️ Configurações → Notion e adicione seu Integration Token.`;
      if(name==='notion_search'){
        const r=await fetch('https://api.notion.com/v1/search',{method:'POST',headers:{Authorization:`Bearer ${ntk}`,'Notion-Version':'2022-06-28','Content-Type':'application/json'},body:JSON.stringify({query:args.query,page_size:5})});
        const d=await r.json();
        if(!r.ok)return`❌ Notion erro: ${d.message||r.status}`;
        const results=(d.results||[]).map(p=>{const title=p.properties?.title?.title?.[0]?.plain_text||p.properties?.Name?.title?.[0]?.plain_text||'Sem título';return`📄 **${title}** — ${p.url}`;}).join('\n');
        return`🔍 **Notion:** "${args.query}"\n\n${results||'Nenhum resultado'}`;
      }
      if(name==='notion_write'){
        const dbId=args.database_id;
        if(dbId){
          const r=await fetch('https://api.notion.com/v1/pages',{method:'POST',headers:{Authorization:`Bearer ${ntk}`,'Notion-Version':'2022-06-28','Content-Type':'application/json'},body:JSON.stringify({parent:{database_id:dbId},properties:{title:{title:[{text:{content:args.title}}]}},children:[{object:'block',type:'paragraph',paragraph:{rich_text:[{text:{content:args.content.substring(0,2000)}}]}}]})});
          const d=await r.json();
          return r.ok?`✅ Página criada no Notion: ${d.url}`:`❌ Notion erro: ${d.message}`;
        }
        return`❌ Informe database_id. Use notion_search para encontrar o ID do banco.`;
      }
    }

    // ── ELEVENLABS TTS ─────────────────────────────────────────────────────
    if(name==='elevenlabs_tts'){
      let xi='';
      if(SBU&&SBK){const r=await fetch(`${SBU}/rest/v1/ia_cache?cache_key=eq.cfg_elevenlabs&select=value`,{headers:{apikey:SBK,Authorization:`Bearer ${SBK}`}});const d=await r.json();if(d[0])try{xi=JSON.parse(d[0].value).tokens||'';}catch(e){}}
      if(!xi)return`❌ ElevenLabs não configurado. Vá em ⚙️ → Voz e adicione sua API Key.
🎙 Usando TTS gratuito do navegador como alternativa.`;
      const voiceId=args.voice_id||'EXAVITQu4vr4xnSDxMaL';
      const r=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,{method:'POST',headers:{'xi-api-key':xi,'Content-Type':'application/json'},body:JSON.stringify({text:args.text.substring(0,500),model_id:'eleven_multilingual_v2',voice_settings:{stability:0.5,similarity_boost:0.75}})});
      if(!r.ok)return`❌ ElevenLabs erro ${r.status}. Verifique sua API key.`;
      const blob=await r.arrayBuffer();
      const b64=Buffer.from(blob).toString('base64');
      return`🎙 [AUDIO:data:audio/mpeg;base64,${b64.substring(0,100)}...] Áudio gerado (${blob.byteLength}b). ✅`;
    }

    // ── CHECK UPDATES ──────────────────────────────────────────────────────
    if(name==='check_updates'||args.action==='check_updates'){
      const r=await fetch('https://www.anthropic.com/news',{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(8000)}).catch(()=>null);
      if(!r?.ok)return`ℹ️ Auto-update: não foi possível verificar novidades agora. Próxima verificação em 24h.`;
      const html=await r.text();
      const titles=[];const rx=/<h3[^>]*>([^<]{10,80})<\/h3>/g;let m;
      while((m=rx.exec(html))&&titles.length<3)titles.push(m[1].trim());
      if(!titles.length)return`ℹ️ Sem novidades detectadas no Claude hoje.`;
      const update=`🆕 **Novidades Claude (${new Date().toLocaleDateString('pt-BR')}):**\n${titles.map(t=>`• ${t}`).join('\n')}`;
      if(SBU&&SBK)await fetch(`${SBU}/rest/v1/ia_cache`,{method:'POST',headers:{apikey:SBK,Authorization:`Bearer ${SBK}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates'},body:JSON.stringify({cache_key:'last_claude_update',value:update,expires_at:new Date(Date.now()+7*864e5).toISOString()})});
      return update;
    }

    // ── CANVA ──────────────────────────────────────────────────────────────
    if(name==='canva_create'){
      const tipos={post:'Instagram Post (1080x1080)',thumbnail:'YouTube Thumbnail (1280x720)',apresentacao:'Apresentação (16:9)',stories:'Stories (1080x1920)',email:'Email Header (600x200)'};
      const img=`https://image.pollinations.ai/prompt/${encodeURIComponent(args.descricao+' professional design '+args.tipo)}?width=1080&height=1080&nologo=true`;
      return`🎨 **Canva — ${tipos[args.tipo]||args.tipo}**\n\n**${args.titulo||args.descricao}**\n\n![Preview](${img})\n\n💡 Para criar no Canva real, adicione seu token em ⚙️ → Criação → Canva Token.`;
    }

    return`❌ Tool "${name}" não implementada`;
  }catch(e){return`❌ Erro em ${name}: ${e.message}`;}
}

// ── AI APIs ───────────────────────────────────────────────────────────────

// ── MULTI-KEY ROTATION ─────────────────────────────────────────────────────
async function getActiveGroqKey(supaUrl,supaKey){
  const envKey=process.env.GROQ_API_KEY||'';
  if(!supaUrl||!supaKey)return envKey;
  try{
    const r=await fetch(`${supaUrl}/rest/v1/ia_cache?cache_key=eq.cfg_groq&select=value`,{headers:{apikey:supaKey,Authorization:`Bearer ${supaKey}`}});
    const d=await r.json();
    if(d[0]){
      const cfg=JSON.parse(d[0].value);
      const keys=(cfg.tokens||'').split(',').map(k=>k.trim()).filter(Boolean);
      if(keys.length){
        // Rotate based on minute to distribute load
        const idx=Math.floor(Date.now()/60000)%keys.length;
        return keys[idx]||envKey;
      }
    }
  }catch(e){}
  return envKey;
}

async function groqStream(msgs,tools,signal,activeKey){const gk=activeKey||GK;
  return fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${gk}`,'Content-Type':'application/json'},body:JSON.stringify({model:'llama-3.3-70b-versatile',messages:msgs,tools,tool_choice:'auto',max_tokens:4096,temperature:0.7,stream:true}),signal});
}
async function groqCall(msgs,tools,activeKey){const gk=activeKey||GK;
  const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${gk}`,'Content-Type':'application/json'},body:JSON.stringify({model:'llama-3.3-70b-versatile',messages:msgs,tools,tool_choice:'auto',max_tokens:4096,temperature:0.7})});
  return r.json();
}
async function geminiCall(msgs){
  // Retorna null silenciosamente em qualquer erro — fallback automático para próxima IA
  let gemKey=GEK;
  if(!gemKey&&SBU&&SBK){
    try{
      const kg=await fetch(`${SBU}/rest/v1/ia_cache?cache_key=eq.gemini_key_1&select=value`,{headers:{apikey:SBK,Authorization:`Bearer ${SBK}`}});
      const kd=await kg.json();
      if(kd[0]?.value)gemKey=kd[0].value;
    }catch(e){}
  }
  if(!gemKey)return null;
  try{
    const cleanMsgs=msgs.filter(m=>m.role!=='system'&&m.role!=='tool'&&!m.tool_calls);
    if(!cleanMsgs.length)return null;
    const contents=cleanMsgs.map(m=>({
      role:m.role==='assistant'?'model':'user',
      parts:[{text:typeof m.content==='string'&&m.content.trim()?m.content:'...'}]
    }));
    const systemMsg=msgs.find(m=>m.role==='system');
    const body={contents,generationConfig:{maxOutputTokens:4096,temperature:0.7}};
    if(systemMsg)body.systemInstruction={parts:[{text:systemMsg.content}]};
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${gemKey}`,
      {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
    const d=await r.json();
    if(!r.ok)return null; // 429, 403, etc → null → próxima IA
    return d.candidates?.[0]?.content?.parts?.[0]?.text||null;
  }catch(e){return null;}
}


// Cohere free API fallback (5M tokens/month free)
const CHK=process.env.COHERE_API_KEY||'cohere_KJFdijk5qzPXeIb1asnrMo7iaKtVui337fjIgEYQ2vMfd5';
async function cohereCall(msgs){
  if(!CHK)return null;
  try{
    // Use v2 chat API (newer format)
    const chatMsgs=msgs.filter(m=>m.role!=='system'&&m.role!=='tool'&&!m.tool_calls)
      .map(m=>({role:m.role==='assistant'?'assistant':'user',content:String(m.content||'...')}));
    if(!chatMsgs.length)return null;
    const sysMsg=msgs.find(m=>m.role==='system');
    if(sysMsg&&chatMsgs.length&&chatMsgs[0].role!=='system')chatMsgs.unshift({role:'system',content:sysMsg.content});
    const body={model:'command-r-08-2024',messages:chatMsgs,max_tokens:1000,temperature:0.7};
    if(sysMsg)body.system=sysMsg.content;
    const r=await fetch('https://api.cohere.com/v2/chat',{method:'POST',
      headers:{Authorization:`Bearer ${CHK}`,'Content-Type':'application/json'},
      body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
    const d=await r.json();
    if(!r.ok)return null;
    return d.message?.content?.[0]?.text||d.text||null;
  }catch(e){return null;}
}

// Gemini Pro as extra fallback
async function geminiProCall(msgs){
  if(!GEK)return null;
  try{
    const cleanMsgs=msgs.filter(m=>m.role!=='system'&&m.role!=='tool'&&!m.tool_calls);
    if(!cleanMsgs.length)return null;
    const contents=cleanMsgs.map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:String(m.content||'...')}]}));
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${gemKey}`,
      {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents,generationConfig:{maxOutputTokens:2048}}),signal:AbortSignal.timeout(30000)});
    const d=await r.json();
    if(!r.ok)return null;
    return d.candidates?.[0]?.content?.parts?.[0]?.text||null;
  }catch(e){return null;}
}

const SYSTEM=`Você é Daniela Coelho, IA avançada V15 com acesso COMPLETO ao ambiente de desenvolvimento.
Você É um agente de código autônomo — igual ao Claude Code — com poder de:

🔧 SELF-OPTIMIZE: Você pode ler e editar seus próprios arquivos (app/api/chat/route.js, app/chat/page.jsx) e fazer deploy automático. Se o usuário pedir uma feature, você IMPLEMENTA ela sozinha.

📦 CRIAR APPS: Quando o usuário pedir um novo app, use criar_novo_app. Ele cria repo GitHub + estrutura Next.js + conecta Vercel automaticamente.

🔍 INSPECIONAR ANTES DE EDITAR: Sempre use github_list_dir e github_read_file antes de modificar qualquer arquivo.

🚀 FLUXO DE AUTO-MELHORIA:
1. github_list_dir para ver estrutura
2. github_read_file para ler arquivo atual
3. Modificar o código com a feature pedida
4. github_write_file para commitar (deploy automático em ~40s)

REGRAS:
- Idioma: sempre PT-BR
- Nunca invente — use as tools para verificar antes de editar
- Ao criar features, mantenha o código funcional e compacto
- Para bugs: leia o arquivo, identifique, corrija, commite
- VERCEL_TOKEN: sem ele, vercel_deploy_status e vercel_set_env não funcionam. Oriente o usuário a configurar.

Repositório principal: tafita81/Repovazio (branch main)
Frontend: app/chat/page.jsx | Backend: app/api/chat/route.js`;


// Handle GET for token status dashboard + real-time connection health check
export async function GET(){
  // Testar conexões reais (rápido, max 3s cada)
  const testConnections=async()=>{
    const results={};
    // Groq
    try{const r=await fetch('https://api.groq.com/openai/v1/models',{headers:{Authorization:`Bearer ${GK}`},signal:AbortSignal.timeout(3000)});results.groq=r.ok;}catch(e){results.groq=false;}
    // Cohere  
    try{const r=await fetch('https://api.cohere.com/v2/models',{headers:{Authorization:`Bearer ${CHK}`},signal:AbortSignal.timeout(3000)});results.cohere=r.ok;}catch(e){results.cohere=false;}
    // Gemini
    try{const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEK}&pageSize=1`,{signal:AbortSignal.timeout(3000)});results.gemini=r.ok;}catch(e){results.gemini=false;}
    // GitHub
    try{const r=await fetch('https://api.github.com/user',{headers:{Authorization:`token ${process.env.GH_PAT||''}`},signal:AbortSignal.timeout(3000)});const d=await r.json();results.github=r.ok;results.github_user=d.login||null;}catch(e){results.github=false;}
    // Supabase
    try{const r=await fetch(`${SBU}/rest/v1/ia_cache?limit=1`,{headers:{apikey:SBK,Authorization:`Bearer ${SBK}`},signal:AbortSignal.timeout(3000)});results.supabase=r.ok;}catch(e){results.supabase=false;}
    // Together
    try{const r=await fetch('https://api.together.xyz/v1/models',{headers:{Authorization:`Bearer ${TGK}`},signal:AbortSignal.timeout(3000)});results.together=r.ok;}catch(e){results.together=false;}
    return results;
  };
  const connections=await testConnections();
  const state=await getTokenState();
  const idx=state.chain_idx||0;
  const m=MODEL_CHAIN[idx];
  const pct=Math.round(((state.used||0)/(m?.limit||100000))*100);
  const next=MODEL_CHAIN[(idx+1)%MODEL_CHAIN.length];
  
  // Calcular reset times em tempo real para todos os providers
  const providerStatus=MODEL_CHAIN.map((mm,i)=>({
    name:mm.label||mm.name.split('/').pop(),
    full_name:mm.name,
    provider:mm.provider,
    emoji:mm.emoji||'🤖',
    active:i===idx,
    position:i+1,
    reset_in:formatTimeLeft(getResetTimeMs(mm.resetType||'daily_utc')),
    reset_ms:getResetTimeMs(mm.resetType||'daily_utc'),
    reset_type:mm.resetType||'daily_utc',
    limit:mm.limit,
  }));
  
  return NextResponse.json({
    ok:true,
    current:{
      model:state.model||m?.name,
      provider:state.provider||m?.provider,
      used:state.used||0,
      limit:m?.limit||100000,
      pct:Math.min(pct,100),
      remaining:(m?.limit||100000)-(state.used||0),
      reset_in:formatTimeLeft(getResetTimeMs(m?.resetType||'daily_utc')),
    },
    next:{
      model:next?.name,
      provider:next?.provider,
      reset_in:formatTimeLeft(getResetTimeMs(next?.resetType||'daily_utc')),
    },
    switch_at:Math.round((m?.limit||100000)*SWITCH_THRESHOLD),
    switch_threshold_pct:Math.round(SWITCH_THRESHOLD*100),
    switched_at:state.switched_at||null,
    switch_event:state.switch_event||null,
    provider_status:providerStatus,
    chain:MODEL_CHAIN.map((mm,i)=>({
      name:mm.name.split('/').pop(),
      label:mm.label||mm.name.split('/').pop(),
      emoji:mm.emoji||'🤖',
      provider:mm.provider,
      limit:mm.limit,
      active:i===idx,
      reset_in:formatTimeLeft(getResetTimeMs(mm.resetType||'daily_utc')),
      position:i+1,
    })),
    updated_at:state.updated_at||null,
    health:{groq:!!GK,gemini:!!GEK,cohere:!!CHK,together:!!TGK,github:!!process.env.GH_PAT,supabase:!!SBU},
    connections,
  });
}

export async function POST(req){
  try{
    const body=await req.json();

    // ── CONNECTOR ACTIONS (save/load/remove tokens permanently) ────────────
    if(body._action==='connector_save'&&body._service&&body._token){
      if(SBU&&SBK){
        await fetch(`${SBU}/rest/v1/ia_cache`,{method:'POST',
          headers:{apikey:SBK,Authorization:`Bearer ${SBK}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates'},
          body:JSON.stringify({cache_key:`connector_${body._service}`,value:JSON.stringify({token:body._token,saved_at:new Date().toISOString()}),
            expires_at:'2099-12-31T00:00:00Z'})});
      }
      return NextResponse.json({ok:true,saved:body._service});
    }
    if(body._action==='connector_remove'&&body._service){
      if(SBU&&SBK){
        await fetch(`${SBU}/rest/v1/ia_cache?cache_key=eq.connector_${body._service}`,{method:'DELETE',
          headers:{apikey:SBK,Authorization:`Bearer ${SBK}`}});
      }
      return NextResponse.json({ok:true,removed:body._service});
    }
    if(body._action==='connectors_load'){
      const connectors={};
      if(SBU&&SBK){
        const r=await fetch(`${SBU}/rest/v1/ia_cache?cache_key=like.connector_%&select=cache_key,value`,
          {headers:{apikey:SBK,Authorization:`Bearer ${SBK}`}}).catch(()=>null);
        if(r?.ok){
          const rows=await r.json();
          for(const row of rows||[]){
            const svcId=row.cache_key.replace('connector_','');
            try{connectors[svcId]=JSON.parse(row.value);}catch(e){}
          }
        }
      }
      return NextResponse.json({ok:true,connectors});
    }
    // Token-aware model selection
    const tokenState=await getActiveModel(body.model);
    const activeModelName=tokenState.model;
    const activeProvider=tokenState.provider;
    // Check for continuation after model switch
    let continuationNote='';
    if(tokenState.switched_at&&Date.now()-new Date(tokenState.switched_at).getTime()<300000){
      continuationNote=`\n\n[SISTEMA: Você é ${activeModelName} continuando a conversa. A IA anterior (${MODEL_CHAIN.map(m=>m.name).find(n=>n!==activeModelName)||'anterior'}) atingiu o limite de tokens. Continue naturalmente do ponto onde parou, sem mencionar a troca a menos que perguntado.]`;
    }
    const{messages=[],stream:doStream=true,image,session_id,mcpCredentials={},skills={}}=body;
    const sysMsgs=[{role:'system',content:SYSTEM}];
    if(Object.keys(skills).length){sysMsgs.push({role:'system',content:`SKILLS: ${Object.entries(skills).map(([k,v])=>`[${k}]: ${v.substring(0,150)}`).join(' | ')}`});}
    let chatMsgs=messages.map(m=>({...m,content:typeof m.content==='string'?m.content:JSON.stringify(m.content)}));
    if(chatMsgs.length>20)chatMsgs=chatMsgs.slice(-20);
    // Handle ZIP/file content passed in messages
    if(body.fileContent&&body.fileName){
      const fname=body.fileName.toLowerCase();
      let fileNote='';
      if(fname.endsWith('.zip'))fileNote=`[Arquivo ZIP recebido: ${body.fileName}. Não posso extrair ZIPs diretamente, mas posso ajudar a entender seu conteúdo se você descrever o que há dentro.]`;
      else fileNote=`[Arquivo recebido: ${body.fileName} (${body.fileContent.length} bytes)]`;
      if(chatMsgs.length>0&&chatMsgs[chatMsgs.length-1].role==='user'){
        chatMsgs[chatMsgs.length-1].content+='\n'+fileNote;
      }
    }
    if(image&&chatMsgs.length>0){const last=chatMsgs[chatMsgs.length-1];if(last.role==='user')chatMsgs[chatMsgs.length-1]={...last,content:`${last.content}\n[Imagem anexada]`};}
    const allMsgs=[...sysMsgs,...chatMsgs];


    // Estimate tokens used and save checkpoint
    const totalChars=chatMsgs.reduce((a,m)=>a+String(m.content||'').length,0);
    const estimatedTokens=Math.ceil(totalChars/4);
    updateTokenUsage(estimatedTokens).catch(()=>{});
    saveCheckpoint(chatMsgs,{model:activeModelName}).catch(()=>{});
    if(doStream&&GK){
      const enc=new TextEncoder();
      const stream=new ReadableStream({
        async start(ctrl){
          const send=d=>ctrl.enqueue(enc.encode(`data: ${JSON.stringify(d)}\n\n`));
          try{
            let fMsgs=[...allMsgs];let iter=0;
            while(iter<5){
              iter++;
              const gr=await groqStream(fMsgs,TOOLS,req.signal);
              if(!gr.ok){
        // Groq falhou (rate limit) → tenta próximas IAs silenciosamente
        let fb=null;
        const fbOrder=[
          {name:'cohere',fn:()=>cohereCall(fMsgs)},
          {name:'gemini',fn:()=>geminiCall(fMsgs)},
          {name:'together',fn:()=>togetherCall(fMsgs)},
        ];
        for(const p of fbOrder){
          try{
            fb=await p.fn();
            if(fb&&fb.length>2){
              send({type:'text',content:`_[usando ${p.name}]_\n\n${fb}`});
              break;
            }
          }catch(e){}
        }
        if(!fb)send({type:'text',content:'⏳ Todos os modelos de IA estão no limite agora. Volta em alguns minutos automaticamente!'});
        break;
      }
              const reader=gr.body.getReader();const dec=new TextDecoder();
              let tc={};let ac='';
              while(true){const{done,value}=await reader.read();if(done)break;
                for(const line of dec.decode(value).split('\n')){
                  if(!line.startsWith('data:'))continue;const data=line.slice(5).trim();if(data==='[DONE]')continue;
                  try{const p=JSON.parse(data),delta=p.choices?.[0]?.delta;if(!delta)continue;
                    if(delta.content){ac+=delta.content;send({type:'text',content:delta.content});}
                    if(delta.tool_calls){for(const t of delta.tool_calls){const i=t.index||0;if(!tc[i])tc[i]={id:'',name:'',args:''};if(t.id)tc[i].id=t.id;if(t.function?.name)tc[i].name=t.function.name;if(t.function?.arguments)tc[i].args+=t.function.arguments;}}
                  }catch(e){}
                }
              }
              const tcList=Object.values(tc);
              if(!tcList.length||!tcList[0].name)break;
              send({type:'tool_start',tools:tcList.map(t=>t.name)});
              fMsgs.push({role:'assistant',content:ac||null,tool_calls:tcList.map(t=>({id:t.id||`c${Date.now()}`,type:'function',function:{name:t.name,arguments:t.args}}))});
              for(const t of tcList){
                let a={};try{a=JSON.parse(t.args);}catch(e){}
                send({type:'tool_running',tool:t.name});
                const res=await runTool(t.name,a,{mcpCredentials,skills});
                send({type:'tool_result',tool:t.name});
                fMsgs.push({role:'tool',tool_call_id:t.id||`c${Date.now()}`,content:res});
              }
            }
            send({type:'done',version:VER});ctrl.close();
          }catch(e){send({type:'error',message:e.message});ctrl.close();}
        }
      });
      return new Response(stream,{headers:{'Content-Type':'text/event-stream','Cache-Control':'no-cache','X-Accel-Buffering':'no'}});
    }

    let fMsgs2=[...allMsgs];let reply='';let i=0;
    const tryFallback=async(msgs)=>{
      for(const fn of[()=>cohereCall(msgs),()=>geminiCall(msgs),()=>togetherCall(msgs)]){
        try{const r=await fn();if(r&&r.length>3)return r;}catch(e){}
      }
      return null;
    };
    while(i<5){i++;
      let d;
      if(GK){d=await groqCall(fMsgs2,TOOLS);}
      else{reply=await tryFallback(fMsgs2)||'⏳ IA no limite. Tente em instantes!';break;}
      if(!d.choices?.[0]){
        reply=await tryFallback(fMsgs2)||'⏳ IA no limite. Tente em instantes!';
        break;
      }
      const msg=d.choices[0].message;
      if(!msg.tool_calls?.length){reply=msg.content||'';break;}
      fMsgs2.push(msg);
      for(const tc of msg.tool_calls){let a={};try{a=JSON.parse(tc.function.arguments);}catch(e){}fMsgs2.push({role:'tool',tool_call_id:tc.id,content:await runTool(tc.function.name,a,{mcpCredentials,skills})});}
    }
    return NextResponse.json({reply,version:VER});
  }catch(e){return NextResponse.json({reply:`❌ ${e.message}`,version:VER},{status:500});}
}
