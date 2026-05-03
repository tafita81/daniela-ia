// app/api/ia-chat/route.js — DANIELA V15 — Claude Code parity: GitHub+Vercel+Supabase+Self-Optimize
import{NextResponse}from'next/server';
export const runtime='nodejs';
export const maxDuration=60;

const GK=process.env.GROQ_API_KEY,GEK=process.env.GEMINI_API_KEY;
const PAT=process.env.GH_PAT,SBU=process.env.NEXT_PUBLIC_SUPABASE_URL,SBK=process.env.SUPABASE_SERVICE_KEY;
const VTK=process.env.VERCEL_TOKEN,VTM=process.env.VERCEL_TEAM_ID||'team_zr9vAef0Zz3njNAiGm3v5Y3h';
const REPO='tafita81/Repovazio',VER='V15-ULTRA-2026-05-03';

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
      const r=await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEK}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{inline_data:{mime_type:'image/jpeg',data:args.url.replace(/^data:image\/\w+;base64,/,'')}},{text:args.pergunta||'Descreva'}]}]})});
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

    return`❌ Tool "${name}" não implementada`;
  }catch(e){return`❌ Erro em ${name}: ${e.message}`;}
}

// ── AI APIs ───────────────────────────────────────────────────────────────
async function groqStream(msgs,tools,signal){
  return fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${GK}`,'Content-Type':'application/json'},body:JSON.stringify({model:'llama-3.3-70b-versatile',messages:msgs,tools,tool_choice:'auto',max_tokens:4096,temperature:0.7,stream:true}),signal});
}
async function groqCall(msgs,tools){
  const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${GK}`,'Content-Type':'application/json'},body:JSON.stringify({model:'llama-3.3-70b-versatile',messages:msgs,tools,tool_choice:'auto',max_tokens:4096,temperature:0.7})});
  return r.json();
}
async function geminiCall(msgs){
  if(!GEK)return'❌ Sem API configurada';
  const contents=msgs.filter(m=>m.role!=='system').map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:typeof m.content==='string'?m.content:JSON.stringify(m.content)}]}));
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEK}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents,generationConfig:{maxOutputTokens:4096}})});
  const d=await r.json();return d.candidates?.[0]?.content?.parts?.[0]?.text||'Erro Gemini';
}

const SYSTEM=`Você é Daniela Coelho, IA avançada V15 com acesso COMPLETO ao ambiente de desenvolvimento.
Você É um agente de código autônomo — igual ao Claude Code — com poder de:

🔧 SELF-OPTIMIZE: Você pode ler e editar seus próprios arquivos (app/api/ia-chat/route.js, app/ia/page.jsx) e fazer deploy automático. Se o usuário pedir uma feature, você IMPLEMENTA ela sozinha.

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
Frontend: app/ia/page.jsx | Backend: app/api/ia-chat/route.js`;

export async function POST(req){
  try{
    const body=await req.json();
    const{messages=[],stream:doStream=true,image,session_id,mcpCredentials={},skills={}}=body;
    const sysMsgs=[{role:'system',content:SYSTEM}];
    if(Object.keys(skills).length){sysMsgs.push({role:'system',content:`SKILLS: ${Object.entries(skills).map(([k,v])=>`[${k}]: ${v.substring(0,150)}`).join(' | ')}`});}
    let chatMsgs=messages.map(m=>({...m,content:typeof m.content==='string'?m.content:JSON.stringify(m.content)}));
    if(chatMsgs.length>20)chatMsgs=chatMsgs.slice(-20);
    if(image&&chatMsgs.length>0){const last=chatMsgs[chatMsgs.length-1];if(last.role==='user')chatMsgs[chatMsgs.length-1]={...last,content:`${last.content}\n[Imagem anexada]`};}
    const allMsgs=[...sysMsgs,...chatMsgs];

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
              if(!gr.ok){send({type:'text',content:await geminiCall(fMsgs)});break;}
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
    while(i<5){i++;
      let d;if(GK){d=await groqCall(fMsgs2,TOOLS);}else{reply=await geminiCall(fMsgs2);break;}
      const msg=d.choices?.[0]?.message;if(!msg){reply=d.error?.message||'Erro';break;}
      if(!msg.tool_calls?.length){reply=msg.content||'';break;}
      fMsgs2.push(msg);
      for(const tc of msg.tool_calls){let a={};try{a=JSON.parse(tc.function.arguments);}catch(e){}fMsgs2.push({role:'tool',tool_call_id:tc.id,content:await runTool(tc.function.name,a,{mcpCredentials,skills})});}
    }
    return NextResponse.json({reply,version:VER});
  }catch(e){return NextResponse.json({reply:`❌ ${e.message}`,version:VER},{status:500});}
}
