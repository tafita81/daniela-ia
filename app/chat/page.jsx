'use client';
import{useState,useRef,useEffect}from'react';

const STORAGE={
  get:(k,d)=>{try{return JSON.parse(localStorage.getItem(k))||d;}catch{return d;}},
  set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch{}}
};

export default function Chat(){
  const[msgs,setMsgs]=useState([]);
  const[input,setInput]=useState('');
  const[loading,setLoading]=useState(false);
  const[streaming,setStreaming]=useState('');
  const[toolStatus,setToolStatus]=useState('');
  const[file,setFile]=useState(null);
  const[panel,setPanel]=useState(null); // 'connectors'|'skills'|'history'|null
  const[connectors,setConnectors]=useState(()=>STORAGE.get('daniela_connectors',{}));
  const[skills,setSkills]=useState(()=>STORAGE.get('daniela_skills',{}));
  const[sessions,setSessions]=useState(()=>STORAGE.get('daniela_sessions',[]));
  const[newConn,setNewConn]=useState({name:'',url:'',token:''});
  const[newSkill,setNewSkill]=useState({name:'',content:''});
  const[speaking,setSpeaking]=useState(false);
  const[useQwen,setUseQwen]=useState(false);
  const[sessionId]=useState(()=>Date.now().toString(36));
  const bottomRef=useRef(null);const taRef=useRef(null);const fileRef=useRef(null);const abortRef=useRef(null);

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:'smooth'});},[msgs,streaming]);
  useEffect(()=>{if(taRef.current){taRef.current.style.height='auto';taRef.current.style.height=Math.min(taRef.current.scrollHeight,180)+'px';}},[input]);

  function saveSession(m){
    if(!m.length)return;
    const s={id:sessionId,title:m[0]?.content?.substring(0,35)||'Chat',msgs:m,ts:Date.now()};
    const prev=STORAGE.get('daniela_sessions',[]).filter(x=>x.id!==sessionId);
    const updated=[s,...prev].slice(0,20);
    STORAGE.set('daniela_sessions',updated);setSessions(updated);
  }
  function saveConnectors(c){STORAGE.set('daniela_connectors',c);setConnectors(c);}
  function saveSkills(s){STORAGE.set('daniela_skills',s);setSkills(s);}

  // Text-to-Speech (Web Speech API - FREE, no API key needed)
  function speak(text){
    if(!window.speechSynthesis)return;
    if(speaking){window.speechSynthesis.cancel();setSpeaking(false);return;}
    const utt=new SpeechSynthesisUtterance(text.replace(/[#*`\[\]]/g,'').substring(0,1000));
    utt.lang='pt-BR';utt.rate=1.0;utt.pitch=1.1;
    const voices=window.speechSynthesis.getVoices();
    const pt=voices.find(v=>v.lang.includes('pt-BR'))||voices.find(v=>v.lang.includes('pt'));
    if(pt)utt.voice=pt;
    utt.onend=()=>setSpeaking(false);utt.onerror=()=>setSpeaking(false);
    setSpeaking(true);window.speechSynthesis.speak(utt);
  }

  async function handleFile(e){
    const f=e.target.files[0];if(!f)return;
    const reader=new FileReader();
    reader.onload=ev=>setFile({name:f.name,type:f.type,data:ev.target.result,preview:f.type.startsWith('image/')?ev.target.result:null});
    reader.readAsDataURL(f);
  }

  async function send(){
    const text=input.trim();
    if((!text&&!file)||loading)return;
    const content=text+(file?`\n📎 ${file.name}`:'');
    const userMsg={role:'user',content};
    const newMsgs=[...msgs,userMsg];
    setMsgs(newMsgs);setInput('');setStreaming('');setToolStatus('');setLoading(true);
    const fileData=file?.data;setFile(null);
    abortRef.current=new AbortController();
    let acc='';
    try{
      const res=await fetch('/api/ia-chat',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({messages:newMsgs,stream:true,image:fileData,session_id:sessionId,mcpCredentials:connectors,skills,useQwen}),signal:abortRef.current.signal});
      if(!res.ok||!res.body){const d=await res.json().catch(()=>({reply:'Erro'}));const fm=[...newMsgs,{role:'assistant',content:d.reply}];setMsgs(fm);saveSession(fm);setLoading(false);return;}
      const reader=res.body.getReader();const dec=new TextDecoder();
      while(true){const{done,value}=await reader.read();if(done)break;
        for(const line of dec.decode(value).split('\n')){
          if(!line.startsWith('data:'))continue;
          try{const ev=JSON.parse(line.slice(5).trim());
            if(ev.type==='text'){acc+=ev.content;setStreaming(acc);}
            else if(ev.type==='tool_start')setToolStatus(`🔧 ${ev.tools?.join(', ')}`);
            else if(ev.type==='tool_running')setToolStatus(`⚙️ ${ev.tool}...`);
            else if(ev.type==='tool_result')setToolStatus(`✅ ${ev.tool}`);
            else if(ev.type==='done'){const fm=[...newMsgs,{role:'assistant',content:acc}];setMsgs(fm);setStreaming('');setToolStatus('');saveSession(fm);}
          }catch(e){}
        }
      }
    }catch(e){if(e.name!=='AbortError'){const fm=[...newMsgs,{role:'assistant',content:`❌ ${e.message}`}];setMsgs(fm);saveSession(fm);}}
    setLoading(false);setStreaming('');setToolStatus('');
  }

  function stop(){abortRef.current?.abort();if(streaming){setMsgs(p=>[...p,{role:'assistant',content:streaming}]);}setLoading(false);setStreaming('');setToolStatus('');}
  function handleKey(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}
  function newChat(){setMsgs([]);setInput('');setFile(null);setPanel(null);}

  function md(text){
    const lines=text.split('\n');const out=[];let inCode=false;let codeLines=[];let codeLang='';
    for(let i=0;i<lines.length;i++){
      const line=lines[i];
      if(line.startsWith('```')){
        if(!inCode){inCode=true;codeLang=line.slice(3).trim()||'code';codeLines=[];}
        else{out.push(<div key={i} className="cb"><div className="ch"><span className="cl">{codeLang}</span><button className="cc" onClick={()=>navigator.clipboard.writeText(codeLines.join('\n'))}>Copiar</button></div><pre><code>{codeLines.join('\n')}</code></pre></div>);inCode=false;codeLines=[];}
        continue;
      }
      if(inCode){codeLines.push(line);continue;}
      // GIF / Image markdown
      const img=line.match(/!\[([^\]]*)\]\(([^)]+)\)/);
      if(img){out.push(<img key={i} src={img[2]} alt={img[1]} className="ai-img" loading="lazy"/>);continue;}
      let p=line.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>').replace(/`([^`]+)`/g,'<code class="ic">$1</code>').replace(/^### (.+)/,'<h3>$1</h3>').replace(/^## (.+)/,'<h2>$1</h2>').replace(/^# (.+)/,'<h1>$1</h1>').replace(/^[\-\*] (.+)/,'<li>$1</li>').replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener" class="link">$1</a>');
      out.push(<p key={i} dangerouslySetInnerHTML={{__html:p||'&nbsp;'}}/>);
    }
    return out;
  }

  const empty=msgs.length===0&&!streaming;
  const SUGGEST=['Mostre um GIF de felicidade','Como lidar com síndrome do impostor?','Navegue em psicologia.uol.com.br e me dê um resumo','Crie um poema sobre a mente humana','Qual o status do projeto psicologia.doc?'];
  const connList=Object.keys(connectors);
  const skillList=Object.keys(skills);

  return(
    <div className="app">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sb-top">
          <button className="nb" onClick={newChat}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>Novo chat
          </button>
        </div>
        <div className="sb-list">
          {sessions.slice(0,15).map(s=>(
            <div key={s.id} className={`si${s.id===sessionId?' active':''}`} onClick={()=>setMsgs(s.msgs)}>{s.title}</div>
          ))}
        </div>
        <div className="sb-bot">
          <div className="ver">{VER||'V14'}</div>
          <div className="ui"><div className="ua">D</div><div className="un">Daniela Coelho</div></div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="main">
        {/* HEADER */}
        <header className="hdr">
          <div className="hm"><div className="ha">D</div><span>Daniela</span></div>
          <div className="hbtns">
            <button className={`hb${panel==='history'?' hp':''}`} onClick={()=>setPanel(p=>p==='history'?null:'history')} title="Histórico">📋</button>
            <button className={`hb${panel==='skills'?' hp':''}`} onClick={()=>setPanel(p=>p==='skills'?null:'skills')} title="Skills">{skillList.length?`🧠${skillList.length}`:'🧠'}</button>
            <button className={`hb${panel==='connectors'?' hp':''}`} onClick={()=>setPanel(p=>p==='connectors'?null:'connectors')} title="Conectores MCP">{connList.length?`🔌${connList.length}`:'🔌'}</button>
            <button className={`hb${useQwen?' hp':''}`} onClick={()=>setUseQwen(q=>!q)} title="Qwen 3 (OpenRouter)">{useQwen?'🤖Q3':'🤖'}</button>
            <button className="hb" onClick={newChat} title="Novo chat">✏️</button>
          </div>
        </header>

        {/* PANELS */}
        {panel==='connectors'&&(
          <div className="pnl">
            <div className="pnl-hdr"><span>🔌 Conectores MCP</span><button onClick={()=>setPanel(null)}>✕</button></div>
            <div className="pnl-body">
              <p className="pnl-info">Adicione credenciais de serviços externos (Slack, Notion, Google, etc). Salvas localmente.</p>
              {connList.map(k=>(
                <div key={k} className="pnl-item">
                  <span>🔌 {k}</span>
                  <button onClick={()=>{const c={...connectors};delete c[k];saveConnectors(c);}}>🗑️</button>
                </div>
              ))}
              <div className="pnl-form">
                <input className="pi" placeholder="Nome (ex: slack)" value={newConn.name} onChange={e=>setNewConn(p=>({...p,name:e.target.value}))}/>
                <input className="pi" placeholder="URL da API" value={newConn.url} onChange={e=>setNewConn(p=>({...p,url:e.target.value}))}/>
                <input className="pi" placeholder="Token/API Key" type="password" value={newConn.token} onChange={e=>setNewConn(p=>({...p,token:e.target.value}))}/>
                <button className="pb" onClick={()=>{if(!newConn.name||!newConn.url)return;saveConnectors({...connectors,[newConn.name]:{url:newConn.url,token:newConn.token}});setNewConn({name:'',url:'',token:''});}}>+ Adicionar</button>
              </div>
            </div>
          </div>
        )}
        {panel==='skills'&&(
          <div className="pnl">
            <div className="pnl-hdr"><span>🧠 Skills</span><button onClick={()=>setPanel(null)}>✕</button></div>
            <div className="pnl-body">
              <p className="pnl-info">Skills são instruções especializadas que a Daniela usa automaticamente. Ex: "Responda sempre com exemplos práticos".</p>
              {skillList.map(k=>(
                <div key={k} className="pnl-item">
                  <div><strong>{k}</strong><br/><small>{skills[k].substring(0,60)}...</small></div>
                  <button onClick={()=>{const s={...skills};delete s[k];saveSkills(s);}}>🗑️</button>
                </div>
              ))}
              <div className="pnl-form">
                <input className="pi" placeholder="Nome da skill" value={newSkill.name} onChange={e=>setNewSkill(p=>({...p,name:e.target.value}))}/>
                <textarea className="pi pta" placeholder="Instruções da skill (ex: Sempre responda com bullet points e exemplos práticos da psicologia)" rows={3} value={newSkill.content} onChange={e=>setNewSkill(p=>({...p,content:e.target.value}))}/>
                <button className="pb" onClick={()=>{if(!newSkill.name||!newSkill.content)return;saveSkills({...skills,[newSkill.name]:newSkill.content});setNewSkill({name:'',content:''});}}>+ Salvar Skill</button>
              </div>
            </div>
          </div>
        )}

        {/* MESSAGES */}
        <div className="msgs">
          {empty&&(
            <div className="welcome">
              <div className="wl"><svg width="52" height="52" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#7c3aed" opacity="0.2"/><path d="M25 70 Q50 15 75 70" stroke="#7c3aed" strokeWidth="7" fill="none" strokeLinecap="round"/><circle cx="50" cy="50" r="9" fill="#7c3aed"/></svg></div>
              <h1>Como posso ajudar?</h1>
              <div className="sugs">{SUGGEST.map(s=><button key={s} className="sug" onClick={()=>setInput(s)}>{s}</button>)}</div>
              {(connList.length>0||skillList.length>0)&&(<div className="active-items">
                {connList.length>0&&<span>🔌 {connList.join(', ')}</span>}
                {skillList.length>0&&<span>🧠 {skillList.join(', ')}</span>}
              </div>)}
            </div>
          )}
          {msgs.map((m,i)=>(
            <div key={i} className={`mr ${m.role}`}>
              {m.role==='assistant'&&<div className="av as">D</div>}
              <div className="mb">
                <div className={`mc${m.role==='user'?' ub':''}`}>{m.role==='assistant'?md(m.content):<p>{m.content}</p>}</div>
                <div className="ma">
                  <button onClick={()=>navigator.clipboard.writeText(m.content)} className="ab" title="Copiar">📋</button>
                  {m.role==='assistant'&&<button onClick={()=>speak(m.content)} className={`ab${speaking?' sp':''}`} title="Ouvir voz">{speaking?'🔊':'🔉'}</button>}
                </div>
              </div>
              {m.role==='user'&&<div className="av us">U</div>}
            </div>
          ))}
          {(loading||streaming)&&(
            <div className="mr assistant">
              <div className="av as">D</div>
              <div className="mb">
                {toolStatus&&<div className="ts">{toolStatus}</div>}
                <div className="mc">{streaming?<>{md(streaming)}<span className="cursor"/></>:<div className="typing"><span/><span/><span/></div>}</div>
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        {/* INPUT */}
        <div className="ia">
          {file&&(<div className="fp">{file.preview?<img src={file.preview} className="fp-img" alt="preview"/>:<span>📎 {file.name}</span>}<button onClick={()=>setFile(null)}>✕</button></div>)}
          <div className="ic">
            <button className="ub2" onClick={()=>fileRef.current?.click()} title="Anexar">📎</button>
            <input ref={fileRef} type="file" accept="image/*,application/pdf,.txt,.js,.py,.ts,.jsx,.tsx,.json,.csv" onChange={handleFile} style={{display:'none'}}/>
            <textarea ref={taRef} className="it" placeholder={`Mensagem para Daniela...${useQwen?' [Qwen 3]':''}`} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKey} rows={1}/>
            {loading?<button className="sb stop" onClick={stop}>⏹️</button>:<button className={`sb${input.trim()||file?' active':''}`} onClick={send} disabled={!input.trim()&&!file}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>}
          </div>
          <div className="in">Daniela V14 · Groq{useQwen?' + Qwen3':''} · Giphy · Browser · Skills · MCP · 24/7</div>
        </div>
      </main>

      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        :root{--bg:#0f0f0f;--s1:#181818;--s2:#222;--s3:#2a2a2a;--br:#333;--t1:#f0f0f0;--t2:#888;--acc:#7c3aed;--acc2:#9461fd;--r:12px;}
        body{background:var(--bg);color:var(--t1);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;}
        .app{display:flex;height:100vh;overflow:hidden;}
        .sidebar{width:240px;background:var(--s1);border-right:1px solid var(--br);display:flex;flex-direction:column;flex-shrink:0;}
        .sb-top{padding:10px 8px;}
        .nb{width:100%;display:flex;align-items:center;gap:7px;background:transparent;border:1px solid var(--br);color:var(--t1);padding:8px 12px;border-radius:7px;cursor:pointer;font-size:13px;transition:.2s;}
        .nb:hover{background:var(--s2);}
        .sb-list{flex:1;overflow-y:auto;padding:4px 6px;}
        .si{padding:8px 9px;border-radius:6px;cursor:pointer;font-size:12px;color:var(--t2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:.2s;margin-bottom:1px;}
        .si:hover,.si.active{background:var(--s2);color:var(--t1);}
        .sb-bot{padding:8px;border-top:1px solid var(--br);}
        .ver{font-size:10px;color:var(--t2);text-align:center;padding:4px 0;}
        .ui{display:flex;align-items:center;gap:8px;padding:6px;border-radius:6px;cursor:pointer;}
        .ui:hover{background:var(--s2);}
        .ua{width:28px;height:28px;background:var(--acc);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:#fff;flex-shrink:0;}
        .un{font-size:13px;font-weight:500;}
        .main{flex:1;display:flex;flex-direction:column;min-width:0;overflow:hidden;position:relative;}
        .hdr{display:flex;align-items:center;padding:10px 14px;border-bottom:1px solid var(--br);gap:10px;}
        .hm{display:flex;align-items:center;gap:7px;font-size:14px;font-weight:600;}
        .ha{width:26px;height:26px;background:var(--acc);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;}
        .hbtns{margin-left:auto;display:flex;gap:3px;}
        .hb{background:transparent;border:1px solid transparent;color:var(--t2);cursor:pointer;padding:5px 8px;border-radius:6px;font-size:13px;transition:.2s;}
        .hb:hover{background:var(--s2);color:var(--t1);}
        .hb.hp{background:rgba(124,58,237,0.2);border-color:var(--acc);color:var(--acc2);}
        .pnl{position:absolute;top:45px;right:10px;width:320px;background:var(--s1);border:1px solid var(--br);border-radius:10px;z-index:100;box-shadow:0 8px 24px rgba(0,0,0,.5);max-height:70vh;display:flex;flex-direction:column;}
        .pnl-hdr{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid var(--br);font-weight:600;}
        .pnl-hdr button{background:transparent;border:none;color:var(--t2);cursor:pointer;font-size:16px;}
        .pnl-body{overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;}
        .pnl-info{font-size:12px;color:var(--t2);line-height:1.5;}
        .pnl-item{display:flex;justify-content:space-between;align-items:center;background:var(--s2);padding:8px 10px;border-radius:7px;font-size:13px;}
        .pnl-item button{background:transparent;border:none;cursor:pointer;font-size:14px;}
        .pnl-form{display:flex;flex-direction:column;gap:6px;margin-top:6px;}
        .pi{background:var(--s2);border:1px solid var(--br);color:var(--t1);padding:8px 10px;border-radius:7px;font-size:13px;font-family:inherit;width:100%;outline:none;}
        .pi:focus{border-color:var(--acc);}
        .pta{resize:vertical;min-height:60px;}
        .pb{background:var(--acc);border:none;color:#fff;padding:8px 14px;border-radius:7px;cursor:pointer;font-size:13px;font-weight:500;transition:.2s;}
        .pb:hover{background:var(--acc2);}
        .msgs{flex:1;overflow-y:auto;padding:16px 0;}
        .msgs::-webkit-scrollbar{width:4px;}
        .msgs::-webkit-scrollbar-thumb{background:var(--br);border-radius:2px;}
        .welcome{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 20px;text-align:center;min-height:60%;}
        .wl{margin-bottom:16px;}
        .welcome h1{font-size:24px;font-weight:700;margin-bottom:24px;}
        .sugs{display:flex;flex-wrap:wrap;gap:7px;justify-content:center;max-width:680px;}
        .sug{background:var(--s1);border:1px solid var(--br);color:var(--t2);padding:8px 13px;border-radius:18px;cursor:pointer;font-size:13px;transition:.2s;text-align:left;}
        .sug:hover{background:var(--s2);color:var(--t1);border-color:var(--acc);}
        .active-items{margin-top:16px;font-size:12px;color:var(--acc2);display:flex;gap:10px;flex-wrap:wrap;justify-content:center;}
        .mr{display:flex;align-items:flex-start;gap:10px;padding:12px max(calc((100% - 800px)/2),16px);transition:.15s;}
        .mr:hover{background:rgba(255,255,255,0.02);}
        .mr.user{flex-direction:row-reverse;}
        .av{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;flex-shrink:0;}
        .as{background:var(--acc);color:#fff;}
        .us{background:#5865f2;color:#fff;}
        .mb{flex:1;min-width:0;max-width:720px;}
        .mc{font-size:15px;line-height:1.75;color:var(--t1);}
        .mc p{margin-bottom:7px;}
        .mc p:last-child{margin-bottom:0;}
        .mc h1{font-size:19px;margin:14px 0 7px;font-weight:700;}
        .mc h2{font-size:17px;margin:12px 0 5px;font-weight:700;}
        .mc h3{font-size:15px;margin:10px 0 4px;font-weight:600;}
        .mc li{margin-left:18px;margin-bottom:3px;}
        .mc strong{font-weight:700;color:#fff;}
        .mc em{font-style:italic;color:var(--t2);}
        .ic{background:var(--s2);border:1px solid var(--br);border-radius:4px;padding:1px 5px;font-family:monospace;font-size:13px;color:#e2a96b;}
        .link{color:var(--acc2);text-decoration:none;}
        .link:hover{text-decoration:underline;}
        .ai-img{max-width:100%;max-height:240px;border-radius:8px;margin:6px 0;object-fit:contain;}
        .cb{background:#141420;border:1px solid var(--br);border-radius:8px;overflow:hidden;margin:8px 0;}
        .ch{display:flex;justify-content:space-between;align-items:center;padding:6px 12px;background:#1c1c2e;border-bottom:1px solid var(--br);}
        .cl{font-size:11px;color:var(--t2);font-family:monospace;text-transform:uppercase;}
        .cc{background:transparent;border:none;color:var(--t2);cursor:pointer;font-size:11px;padding:2px 6px;border-radius:3px;}
        .cc:hover{background:var(--s3);color:var(--t1);}
        .cb pre{padding:12px;overflow-x:auto;}
        .cb code{font-family:'JetBrains Mono',monospace;font-size:13px;line-height:1.6;color:#cdd6f4;}
        .ub{background:var(--s3);padding:10px 14px;border-radius:14px 14px 4px 14px;display:inline-block;}
        .ts{background:rgba(124,58,237,0.15);border:1px solid rgba(124,58,237,0.3);border-radius:7px;padding:7px 11px;font-size:12px;color:var(--acc2);margin-bottom:8px;}
        .cursor{display:inline-block;width:2px;height:15px;background:var(--acc);animation:blink .8s infinite;vertical-align:text-bottom;margin-left:1px;}
        @keyframes blink{0%,100%{opacity:1;}50%{opacity:0;}}
        .ma{display:flex;gap:3px;margin-top:4px;opacity:0;transition:.2s;}
        .mr:hover .ma{opacity:1;}
        .ab{background:transparent;border:none;color:var(--t2);cursor:pointer;padding:3px 5px;border-radius:4px;font-size:13px;transition:.2s;}
        .ab:hover,.ab.sp{background:var(--s2);color:var(--t1);}
        .typing{display:flex;gap:4px;align-items:center;padding:7px 2px;}
        .typing span{width:6px;height:6px;background:var(--t2);border-radius:50%;animation:bounce 1.2s infinite;}
        .typing span:nth-child(2){animation-delay:.2s;}.typing span:nth-child(3){animation-delay:.4s;}
        @keyframes bounce{0%,60%,100%{transform:translateY(0);}30%{transform:translateY(-6px);}}
        .ia{padding:10px 14px;background:var(--bg);border-top:1px solid var(--br);}
        .fp{display:flex;align-items:center;gap:8px;padding:7px 12px;background:var(--s1);border:1px solid var(--br);border-radius:8px;margin-bottom:6px;max-width:800px;margin-left:auto;margin-right:auto;}
        .fp-img{width:44px;height:44px;object-fit:cover;border-radius:5px;}
        .fp button{margin-left:auto;background:transparent;border:none;color:var(--t2);cursor:pointer;font-size:15px;}
        .ic{max-width:800px;margin:0 auto;background:var(--s1);border:1px solid var(--br);border-radius:12px;display:flex;align-items:flex-end;gap:5px;padding:9px 10px;transition:.2s;}
        .ic:focus-within{border-color:var(--acc);}
        .ub2{background:transparent;border:none;color:var(--t2);cursor:pointer;padding:4px;font-size:16px;flex-shrink:0;transition:.2s;}
        .ub2:hover{color:var(--t1);}
        .it{flex:1;background:transparent;border:none;outline:none;color:var(--t1);font-size:15px;line-height:1.5;resize:none;max-height:180px;font-family:inherit;}
        .it::placeholder{color:var(--t2);}
        .sb{width:32px;height:32px;border-radius:7px;border:none;background:var(--s2);color:var(--t2);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:.2s;font-size:14px;}
        .sb.active{background:var(--acc);color:#fff;}
        .sb.stop{background:rgba(239,68,68,.2);color:#ef4444;}
        .sb:disabled{cursor:not-allowed;opacity:.35;}
        .in{text-align:center;font-size:11px;color:var(--t2);margin-top:5px;max-width:800px;margin-left:auto;margin-right:auto;}
        @media(max-width:768px){.sidebar{display:none;}.mr{padding:12px 12px;}.pnl{right:4px;width:calc(100vw - 8px);}}
      `}</style>
    </div>
  );
}
