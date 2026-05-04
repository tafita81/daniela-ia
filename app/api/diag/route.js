// @ts-nocheck
import{NextResponse}from'next/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';

const OAI=process.env.OPENAI_API_KEY||'';
const GK=process.env.GROQ_API_KEY||'';
const GEK=process.env.GEMINI_API_KEY||'';

export async function GET(){
  const out={env:{
    has_openai:!!OAI,openai_prefix:OAI.substring(0,12),openai_len:OAI.length,
    has_groq:!!GK,groq_prefix:GK.substring(0,12),groq_len:GK.length,
    has_gemini:!!GEK,gemini_prefix:GEK.substring(0,12),gemini_len:GEK.length,
  },tests:{}};

  // Test Groq sem tools
  try{
    const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{
      method:'POST',headers:{Authorization:`Bearer ${GK}`,'Content-Type':'application/json'},
      body:JSON.stringify({model:'llama-3.3-70b-versatile',messages:[{role:'user',content:'oi'}],max_tokens:5})});
    const d=await r.json();
    out.tests.groq_simple={status:r.status,ok:r.ok,
      reply:r.ok?d.choices?.[0]?.message?.content:null,
      error:r.ok?null:(d.error?.message||JSON.stringify(d).substring(0,200))};
  }catch(e){out.tests.groq_simple={error:e.message};}

  // Test Groq com tools
  try{
    const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{
      method:'POST',headers:{Authorization:`Bearer ${GK}`,'Content-Type':'application/json'},
      body:JSON.stringify({model:'llama-3.3-70b-versatile',
        messages:[{role:'user',content:'liste arquivos em /repo'}],
        tools:[{type:'function',function:{name:'list_files',parameters:{type:'object',properties:{path:{type:'string'}}}}}],
        tool_choice:'auto',max_tokens:200})});
    const d=await r.json();
    out.tests.groq_tools={status:r.status,ok:r.ok,
      tool_called:r.ok?d.choices?.[0]?.message?.tool_calls?.[0]?.function?.name:null,
      error:r.ok?null:(d.error?.message||JSON.stringify(d).substring(0,200))};
  }catch(e){out.tests.groq_tools={error:e.message};}

  // Test OpenAI
  try{
    const r=await fetch('https://api.openai.com/v1/chat/completions',{
      method:'POST',headers:{Authorization:`Bearer ${OAI}`,'Content-Type':'application/json'},
      body:JSON.stringify({model:'gpt-4.1-mini',messages:[{role:'user',content:'oi'}],max_tokens:5})});
    const d=await r.json();
    out.tests.openai={status:r.status,ok:r.ok,
      reply:r.ok?d.choices?.[0]?.message?.content:null,
      error:r.ok?null:(d.error?.message||'').substring(0,200)};
  }catch(e){out.tests.openai={error:e.message};}

  return NextResponse.json(out);
}
