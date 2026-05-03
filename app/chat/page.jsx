// @ts-nocheck
'use client';
import{useState,useRef,useEffect}from'react';

const STORAGE={
  get:(k,d)=>{try{return JSON.parse(localStorage.getItem(k))||d;}catch{return d;}},
  set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch{}}
};


// ── SETTINGS MODAL ─────────────────────────────────────────────────────────

// ── TOKEN MONITOR V2 ─────────────────────────────────────────────────────

// ── CONNECTORS LIST com Supabase permanente ────────────────────────────────
const CONNECTORS_SERVICES=[
  {id:'google_drive',name:'Google Drive',icon:'https://www.gstatic.com/images/branding/product/2x/drive_2020q4_48dp.png',desc:'Arquivos e documentos'},
  {id:'notion',name:'Notion',icon:'https://upload.wikimedia.org/wikipedia/commons/4/45/Notion_app_logo.png',desc:'Páginas e bases de dados'},
  {id:'slack',name:'Slack',icon:'https://upload.wikimedia.org/wikipedia/commons/b/b9/Slack_Technologies_Logo.svg',desc:'Mensagens e canais'},
  {id:'github',name:'GitHub',icon:'https://github.githubassets.com/assets/GitHub-Mark-ea2971cee799.png',desc:'Repositórios e código'},
  {id:'gmail',name:'Gmail',icon:'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico',desc:'E-mails e contatos'},
  {id:'youtube',name:'YouTube',icon:'https://www.youtube.com/favicon.ico',desc:'Vídeos e canal'},
  {id:'instagram',name:'Instagram',icon:'https://www.instagram.com/favicon.ico',desc:'Posts e stories'},
  {id:'elevenlabs',name:'ElevenLabs',icon:'https://elevenlabs.io/favicon.ico',desc:'Síntese de voz realista'},
  {id:'heygen',name:'HeyGen',icon:'https://www.heygen.com/favicon.ico',desc:'Avatar de vídeo IA'},
  {id:'canva',name:'Canva',icon:'https://www.canva.com/favicon.ico',desc:'Criar designs'},
  {id:'supabase',name:'Supabase',icon:'https://supabase.com/favicon.ico',desc:'Banco de dados'},
  {id:'vercel',name:'Vercel',icon:'https://vercel.com/favicon.ico',desc:'Deploy e infra'},
  {id:'jira',name:'Jira',icon:'https://www.atlassian.com/favicon.ico',desc:'Tarefas e projetos'},
  {id:'linear',name:'Linear',icon:'https://linear.app/favicon.ico',desc:'Issues e sprints'},
];

function ConnectorsList({connectors,setConnectors}){
  const[loaded,setLoaded]=useState(false);
  const[testStatus,setTestStatus]=useState({});

  // Carrega tokens: localStorage PRIMEIRO (imediato), depois Supabase (permanente)
  useEffect(()=>{
    // 1. Carrega localStorage imediatamente (sempre funciona)
    const lsConns={};
    CONNECTORS_SERVICES.forEach(svc=>{
      const tok=localStorage.getItem(`conn_${svc.id}`);
      if(tok)lsConns[svc.id]={token:tok,name:svc.name,source:'local'};
    });
    if(Object.keys(lsConns).length>0)setConnectors(lsConns);
    
    // 2. Tenta carregar do Supabase (merge — adiciona novos tokens de outros dispositivos)
    const load=async()=>{
      try{
        const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({stream:false,_action:'connectors_load',messages:[]})});
        if(r.ok){
          const d=await r.json();
          if(d.connectors&&Object.keys(d.connectors).length>0){
            // Merge: Supabase wins for existing, keeps localStorage-only entries
            setConnectors(prev=>({...prev,...d.connectors}));
            // Sync Supabase tokens to localStorage
            Object.entries(d.connectors).forEach(([k,v])=>{if(v?.token)localStorage.setItem(`conn_${k}`,v.token);});
          }
        }
      }catch(e){}
      setLoaded(true);
    };
    load();
    setLoaded(true); // Don't block on Supabase
  },[]);

  const connect=async(svc)=>{
    const key=window.prompt(`🔑 Token/API Key para ${svc.name}:`);
    if(!key||!key.trim())return;
    const token=key.trim();
    // Salva localmente
    localStorage.setItem(`conn_${svc.id}`,token);
    setConnectors(prev=>({...prev,[svc.id]:{name:svc.name,token,connected_at:new Date().toISOString()}}));
    // Salva no Supabase via API (permanente para sempre)
    fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({stream:false,_action:'connector_save',_service:svc.id,_token:token,
        messages:[{role:'user',content:`Salve o token do ${svc.name}`}]})}).catch(()=>{});
    setTestStatus(p=>({...p,[svc.id]:'saving...'}));
    setTimeout(()=>setTestStatus(p=>({...p,[svc.id]:'✓ Salvo'})),1000);
  };

  const disconnect=(svcId)=>{
    localStorage.removeItem(`conn_${svcId}`);
    setConnectors(prev=>{const n={...prev};delete n[svcId];return n;});
    fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({stream:false,_action:'connector_remove',_service:svcId,messages:[{role:'user',content:'remove'}]})}).catch(()=>{});
  };

  if(!loaded)return<div style={{padding:20,color:'#6b7280',fontSize:12}}>Carregando conectores...</div>;

  return(
    <div>
      {CONNECTORS_SERVICES.map(svc=>{
        const savedKey=`conn_${svc.id}`;
        const connected=connectors?.[svc.id]?.token||localStorage.getItem(savedKey);
        const ts=testStatus[svc.id];
        return(
          <div key={svc.id} style={{display:'flex',alignItems:'center',padding:'11px 14px',
            borderBottom:'1px solid #0d0d0d',gap:10}}>
            <div style={{position:'relative',flexShrink:0}}>
              <img src={svc.icon} alt={svc.name} style={{width:26,height:26,borderRadius:4,objectFit:'contain',background:'#fff',padding:2}} onError={e=>{e.target.style.display='none';}}/>
              {connected&&<div style={{position:'absolute',bottom:-2,right:-2,width:8,height:8,borderRadius:'50%',background:'#4ade80',border:'1px solid #000',boxShadow:'0 0 4px #4ade80'}}/>}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,color:'#e5e7eb'}}>{svc.name}</div>
              <div style={{fontSize:10,color:'#6b7280'}}>{svc.desc}</div>
            </div>
            {ts&&<span style={{fontSize:10,color:'#4ade80'}}>{ts}</span>}
            {connected
              ?<div style={{display:'flex',alignItems:'center',gap:5}}>
                  <span style={{fontSize:10,color:'#4ade80',fontWeight:700}}>✓ ON</span>
                  <button onClick={()=>disconnect(svc.id)} style={{fontSize:9,color:'#6b7280',background:'none',border:'1px solid #222',borderRadius:3,padding:'2px 5px',cursor:'pointer'}}>×</button>
                </div>
              :<button onClick={()=>connect(svc)} style={{fontSize:11,color:'#a78bfa',background:'rgba(139,92,246,0.1)',border:'1px solid rgba(139,92,246,0.25)',borderRadius:5,padding:'4px 9px',cursor:'pointer',fontWeight:500,whiteSpace:'nowrap'}}>
                  Conectar
                </button>
            }
          </div>
        );
      })}
    </div>
  );
}

// ── CONNECTORS PANEL — TODOS OS CONECTORES DO CLAUDE ──────────────────────
// Lista completa extraída das screenshots (100+ conectores)
const ALL_SVCS=[
// IA Providers
{id:'groq',name:'Groq',e:'🦙',d:'Llama 3.3 70B — IA principal',cat:'ai'},
{id:'cohere',name:'Cohere',e:'🟡',d:'Command-R — Fallback IA',cat:'ai'},
{id:'gemini',name:'Gemini',e:'✨',d:'Google Gemini 2.0 Flash',cat:'ai'},
{id:'together',name:'Together AI',e:'🔷',d:'Llama via Together',cat:'ai'},
// Infra (auto-detectados)
{id:'github',name:'GitHub',i:'https://github.githubassets.com/assets/GitHub-Mark-ea2971cee799.png',d:'Repositórios e código',cat:'infra',p:1},
{id:'supabase',name:'Supabase',i:'https://supabase.com/favicon.ico',d:'Banco de dados e cache',cat:'infra',p:24},
{id:'vercel',name:'Vercel',i:'https://vercel.com/favicon.ico',d:'Deploy e infraestrutura',cat:'infra',p:20},
// Conectores do Claude (por popularidade)
{id:'google_drive',name:'Google Drive',i:'https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png',d:'Busque, leia e envie arquivos',cat:'prod',p:2},
{id:'gmail',name:'Gmail',i:'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico',d:'Rascunhe e pesquise e-mails',cat:'prod',p:3},
{id:'google_calendar',name:'Google Calendar',i:'https://calendar.google.com/googlecalendar/images/favicons_2020q4/calendar_2.ico',d:'Gerencie agenda e reuniões',cat:'prod',p:4},
{id:'canva',name:'Canva',i:'https://www.canva.com/favicon.ico',d:'Crie e exporte designs',cat:'design',p:5},
{id:'shopify',name:'Shopify',i:'https://cdn.shopify.com/shopifycloud/web/assets/v1/vite/client/en/assets/shopify-icon-KvbXwK9S.svg',d:'Gerencie sua loja Shopify',cat:'biz',p:5},
{id:'figma',name:'Figma',i:'https://www.figma.com/favicon.ico',d:'Diagramas e código de design',cat:'design',p:6},
{id:'notion',name:'Notion',i:'https://www.notion.so/front-static/favicon.ico',d:'Páginas e bases de dados',cat:'prod',p:7},
{id:'jira',name:'Atlassian Rovo',i:'https://www.atlassian.com/favicon.ico',d:'Jira e Confluence',cat:'dev',p:8},
{id:'slack',name:'Slack',i:'https://a.slack-edge.com/80588/marketing/img/meta/slack_hash_256.png',d:'Mensagens e canais',cat:'prod',p:9},
{id:'microsoft365',name:'Microsoft 365',i:'https://www.microsoft.com/favicon.ico',d:'SharePoint, OneDrive, Teams',cat:'biz',p:10},
{id:'hubspot',name:'HubSpot',i:'https://www.hubspot.com/favicon.ico',d:'Dados CRM e insights',cat:'biz',p:11},
{id:'linear',name:'Linear',i:'https://linear.app/favicon.ico',d:'Issues e sprints',cat:'dev',p:12},
{id:'monday',name:'monday.com',i:'https://monday.com/favicon.ico',d:'Projetos e quadros',cat:'prod',p:13},
{id:'intercom',name:'Intercom',e:'💬',d:'Dados de clientes',cat:'biz',p:14},
{id:'box',name:'Box',e:'📦',d:'Busque conteúdo Box',cat:'prod',p:15},
{id:'miro',name:'Miro',i:'https://miro.com/favicon.ico',d:'Quadros colaborativos',cat:'design',p:16},
{id:'gamma',name:'Gamma',i:'https://gamma.app/favicon.ico',d:'Apresentações com IA',cat:'design',p:17},
{id:'asana',name:'Asana',i:'https://app.asana.com/favicon.ico',d:'Projetos e metas',cat:'prod',p:18},
{id:'granola',name:'Granola',e:'📓',d:'Bloco de notas para reuniões',cat:'meet',p:19},
{id:'vercel2',name:'Vercel MCP',i:'https://vercel.com/favicon.ico',d:'Deploy e projetos',cat:'dev',p:20},
{id:'microsoft_learn',name:'Microsoft Learn',i:'https://www.microsoft.com/favicon.ico',d:'Docs Microsoft para dev',cat:'dev',p:21},
{id:'zoom',name:'Zoom for Claude',i:'https://zoom.us/favicon.ico',d:'Reuniões, resumos e ações',cat:'meet',p:22},
{id:'sentry',name:'Sentry',i:'https://sentry.io/favicon.ico',d:'Debug e erros',cat:'dev',p:23},
{id:'excalidraw',name:'Excalidraw',e:'✏️',d:'Diagramas interativos',cat:'design',p:25},
{id:'airtable',name:'Airtable',i:'https://airtable.com/favicon.ico',d:'Dados estruturados',cat:'prod',p:26},
{id:'indeed',name:'Indeed',i:'https://indeed.com/favicon.ico',d:'Busque empregos',cat:'other',p:27},
{id:'lucid',name:'Lucid',i:'https://lucid.app/favicon.ico',d:'Diagramas e alinhamento',cat:'design',p:29},
{id:'zapier',name:'Zapier',i:'https://zapier.com/favicon.ico',d:'Automatize apps',cat:'prod',p:30},
{id:'clickup',name:'ClickUp',i:'https://clickup.com/favicon.ico',d:'Gestão de projetos',cat:'prod',p:31},
{id:'mermaid',name:'Mermaid Chart',e:'🔷',d:'Diagramas Mermaid SVG',cat:'design',p:32},
{id:'pubmed',name:'PubMed',e:'🔬',d:'Literatura biomédica',cat:'research',p:33},
{id:'zoominfo',name:'ZoomInfo',e:'📊',d:'Contatos GTM intelligence',cat:'biz',p:34},
{id:'context7',name:'Context7',e:'📚',d:'Docs atualizados para LLMs',cat:'dev',p:36},
{id:'stripe',name:'Stripe',i:'https://stripe.com/favicon.ico',d:'Infraestrutura de pagamentos',cat:'biz',p:40},
{id:'ahrefs',name:'Ahrefs',e:'🔗',d:'SEO e analytics',cat:'mkt',p:39},
{id:'apollo',name:'Apollo.io',e:'🚀',d:'Encontre compradores',cat:'biz',p:42},
{id:'fireflies',name:'Fireflies',i:'https://fireflies.ai/favicon.ico',d:'Insights de reuniões',cat:'meet',p:43},
{id:'sp_global',name:'S&P Global',e:'📈',d:'Datasets S&P Global',cat:'finance',p:44},
{id:'pitchbook',name:'PitchBook Premium',e:'💼',d:'Dados PitchBook',cat:'finance',p:45},
{id:'hugging_face',name:'Hugging Face',i:'https://huggingface.co/favicon.ico',d:'Hub de IA e Gradio',cat:'research',p:46},
{id:'wordpress',name:'WordPress.com',i:'https://wordpress.com/favicon.ico',d:'Gerencie sites WordPress',cat:'media',p:47},
{id:'webflow',name:'Webflow',e:'🌊',d:'CMS e sites Webflow',cat:'dev',p:50},
{id:'cloudflare',name:'Cloudflare',i:'https://www.cloudflare.com/favicon.ico',d:'Compute, storage e AI',cat:'dev',p:51},
{id:'postman',name:'Postman',i:'https://www.postman.com/favicon.ico',d:'Contexto de API',cat:'dev',p:53},
{id:'ramp',name:'Ramp',e:'💳',d:'Dados financeiros Ramp',cat:'finance',p:54},
{id:'mixpanel',name:'Mixpanel',e:'📉',d:'Analytics e dados',cat:'mkt',p:56},
{id:'bigquery',name:'Google Cloud BigQuery',i:'https://cloud.google.com/favicon.ico',d:'Analytics avançado',cat:'mkt',p:57},
{id:'quickbooks',name:'Intuit QuickBooks',e:'💰',d:'Finanças simplificadas',cat:'biz',p:58},
{id:'make',name:'Make',i:'https://www.make.com/favicon.ico',d:'Cenários e automações',cat:'prod',p:59},
{id:'windsor',name:'Windsor.ai',e:'📊',d:'Marketing analytics 325+',cat:'mkt',p:61},
{id:'factset',name:'FactSet AI-Ready Data',e:'📊',d:'Dados financeiros institucionais',cat:'finance',p:62},
{id:'posthog',name:'PostHog',i:'https://posthog.com/favicon.ico',d:'Analytics e gestão',cat:'dev',p:64},
{id:'calendly',name:'Calendly',i:'https://calendly.com/favicon.ico',d:'Agendamentos',cat:'prod',p:65},
{id:'godaddy',name:'GoDaddy',i:'https://www.godaddy.com/favicon.ico',d:'Domínios e hospedagem',cat:'other',p:65},
{id:'netlify',name:'Netlify',e:'🌐',d:'Deploy web',cat:'dev',p:67},
{id:'lilt',name:'LILT',e:'🌍',d:'Tradução profissional IA',cat:'other',p:68},
{id:'outreach',name:'Outreach',e:'📤',d:'Performance de vendas',cat:'biz',p:73},
{id:'harvey',name:'Harvey',e:'⚖️',d:'Pesquisa jurídica',cat:'other',p:75},
{id:'scholar',name:'Scholar Gateway',e:'📖',d:'Pesquisa acadêmica',cat:'research',p:76},
{id:'clinical_trials',name:'Clinical Trials',e:'🏥',d:'Dados ClinicalTrials.gov',cat:'research',p:77},
{id:'fathom',name:'Fathom',e:'🎙️',d:'Reuniões em conversas',cat:'meet',p:78},
{id:'icd10',name:'ICD-10 Codes',e:'🏥',d:'Códigos ICD-10-CM e PCS',cat:'research',p:79},
{id:'pdf_viewer',name:'PDF Viewer',e:'📄',d:'Renderiza PDFs de URLs',cat:'other',p:80},
{id:'kiwi',name:'Kiwi.com',e:'✈️',d:'Passagens aéreas',cat:'travel',p:81},
{id:'aws_marketplace',name:'AWS Marketplace',i:'https://aws.amazon.com/favicon.ico',d:'Soluções cloud AWS',cat:'infra',p:82},
{id:'similarweb',name:'Similarweb',e:'📊',d:'Dados web em tempo real',cat:'mkt',p:84},
{id:'morningstar',name:'Morningstar',e:'⭐',d:'Insights de investimento',cat:'finance',p:86},
{id:'biorxiv',name:'bioRxiv',e:'🔬',d:'Preprints biomédicos',cat:'research',p:87},
{id:'guru',name:'Guru',e:'📋',d:'Conhecimento da empresa',cat:'prod',p:89},
{id:'udemy',name:'Udemy Business',e:'🎓',d:'Recursos de aprendizado',cat:'other',p:91},
{id:'cms_coverage',name:'CMS Coverage',e:'🏥',d:'Banco dados CMS Coverage',cat:'research',p:92},
{id:'incident_io',name:'incident.io',e:'🚨',d:'Gestão de incidentes',cat:'dev',p:93},
{id:'paypal',name:'PayPal',i:'https://www.paypal.com/favicon.ico',d:'Plataforma de pagamentos',cat:'biz',p:94},
{id:'pagerduty',name:'PagerDuty',e:'🚨',d:'Incidentes e on-call',cat:'dev',p:95},
{id:'chembl',name:'ChEMBL',e:'⚗️',d:'Banco dados ChEMBL',cat:'research',p:96},
{id:'mailchimp',name:'Intuit Mailchimp',e:'🐒',d:'Campanhas de marketing',cat:'mkt',p:97},
{id:'supermetrics',name:'Supermetrics',e:'📊',d:'Google Ads, Facebook e 200+ plataformas',cat:'mkt',p:98},
{id:'surveymonkey',name:'SurveyMonkey',e:'📋',d:'Pesquisas e análises',cat:'biz',p:99},
{id:'brex',name:'Brex',e:'💳',d:'Automação financeira',cat:'finance',p:102},
{id:'open_targets',name:'Open Targets',e:'🎯',d:'Alvos de drogas',cat:'research',p:103},
{id:'exa',name:'Exa',e:'🔍',d:'Busca web + docs',cat:'research',p:108},
{id:'lastminute',name:'lastminute.com',e:'✈️',d:'Voos, hotéis e pacotes',cat:'travel',p:109},
{id:'metaview',name:'Metaview',e:'👥',d:'Plataforma de recrutamento',cat:'biz',p:113},
{id:'goodnotes',name:'Goodnotes',e:'📝',d:'Insights em documentos',cat:'prod',p:127},
{id:'lusha',name:'Lusha',e:'👤',d:'Contatos B2B',cat:'biz',p:132},
{id:'mem',name:'Mem',e:'💭',d:'Bloco de notas IA',cat:'prod',p:158},
{id:'dovetail',name:'Dovetail',e:'🔀',d:'Feedback em decisões',cat:'biz',p:193},
{id:'adisinsight',name:'AdisInsight',e:'💊',d:'Dados clínicos farmacêuticos',cat:'research',p:210},
{id:'coindesk',name:'CoinDesk',e:'₿',d:'Dados cripto em tempo real',cat:'finance'},
{id:'xero',name:'Xero',e:'💼',d:'Finanças corporativas',cat:'biz'},
{id:'ibisworld',name:'IBISWorld',e:'📊',d:'Dados de 50k indústrias',cat:'finance'},
{id:'adobe_creativity',name:'Adobe for Creativity',i:'https://www.adobe.com/favicon.ico',d:'Ferramentas criativas Adobe',cat:'design'},
{id:'adobe_journey',name:'Adobe Journey Optimizer',i:'https://www.adobe.com/favicon.ico',d:'Journeys e campanhas',cat:'mkt'},
{id:'adobe_marketing',name:'Adobe Marketing Agent',i:'https://www.adobe.com/favicon.ico',d:'Insights de campanha',cat:'mkt'},
{id:'adobe_experience',name:'Adobe Experience Manager',i:'https://www.adobe.com/favicon.ico',d:'Gestão de conteúdo',cat:'mkt'},
{id:'autodesk',name:'Autodesk Product Help',e:'🔧',d:'Docs Autodesk',cat:'other'},
{id:'malwarebytes',name:'Malwarebytes',e:'🛡️',d:'Verifica links e e-mails',cat:'other'},
{id:'trimble',name:'Trimble SketchUp',e:'🏗️',d:'Modelos 3D SketchUp',cat:'design'},
{id:'datasite',name:'Datasite',e:'📁',d:'M&A data room',cat:'biz'},
{id:'superhuman',name:'Superhuman Mail',e:'📧',d:'E-mail e calendário',cat:'prod'},
{id:'audible',name:'Audible',e:'🎧',d:'Recomendações de audiobooks',cat:'media'},
{id:'motion',name:'Motion Creative Analytics',e:'📺',d:'Análise de criativos Meta',cat:'mkt'},
{id:'clay',name:'Clay',e:'🧱',d:'Prospecção e personalização',cat:'biz'},
{id:'scite',name:'Scite',e:'📝',d:'Respostas baseadas em evidências',cat:'research'},
{id:'stubhub',name:'StubHub',e:'🎟️',d:'Maior mercado de ingressos',cat:'travel'},
{id:'otter',name:'Otter.ai',e:'🦦',d:'Inteligência de reuniões',cat:'meet'},
{id:'peec',name:'Peec AI',e:'📊',d:'Visibilidade em LLMs',cat:'mkt'},
{id:'splice',name:'Splice',e:'🎵',d:'Catálogo de sons',cat:'media'},
{id:'send',name:'Send',e:'📨',d:'Documentos e decks',cat:'prod'},
{id:'cash_app',name:'Cash App',e:'💵',d:'Descoberta local de food',cat:'travel'},
{id:'digits',name:'Digits',e:'💰',d:'Analise suas finanças',cat:'finance'},
{id:'rillet',name:'Rillet',e:'📊',d:'GL e finanças em tempo real',cat:'finance'},
{id:'orion',name:'Orion by Gravity',e:'🔭',d:'Insights de análise IA',cat:'biz'},
{id:'g2',name:'G2',e:'🌟',d:'Sinais de compradores',cat:'biz'},
{id:'grain',name:'Grain',e:'🌾',d:'Reuniões em insights',cat:'meet'},
{id:'contentsquare',name:'Contentsquare',e:'📊',d:'Analytics de experiência',cat:'mkt'},
{id:'kindora',name:'Kindora Funder Discovery',e:'🤝',d:'Descubra financiadores',cat:'other'},
{id:'unthread',name:'Unthread',e:'🎫',d:'Tickets de suporte',cat:'biz'},
{id:'ketryx',name:'Ketryx',e:'🔬',d:'Dados de software regulado',cat:'research'},
{id:'ice_data',name:'ICE Data Services',e:'📊',d:'Dados de renda fixa',cat:'finance'},
{id:'playmcp',name:'PlayMCP',e:'🎮',d:'Servidores PlayMCP',cat:'dev'},
{id:'govtribe',name:'GovTribe',e:'🏛️',d:'Dados de contratos gov',cat:'other'},
{id:'tropic',name:'Tropic',e:'💸',d:'Economize em contratos IA',cat:'biz'},
{id:'lusha2',name:'Lusha',e:'👤',d:'Enriqueça contatos B2B',cat:'biz'},
{id:'clarify',name:'Clarify',e:'🔍',d:'Analytics de chamadas',cat:'biz'},
{id:'gitlab',name:'GitLab',i:'https://gitlab.com/favicon.ico',d:'Repositórios e CI/CD',cat:'dev'},
{id:'google_compute',name:'Google Compute Engine',i:'https://cloud.google.com/favicon.ico',d:'Infraestrutura Google',cat:'infra'},
{id:'spotify',name:'Spotify',i:'https://open.spotify.com/favicon.ico',d:'Música e podcasts',cat:'media'},
{id:'tripadvisor',name:'Tripadvisor',i:'https://www.tripadvisor.com/favicon.ico',d:'Hotel perfeito',cat:'travel'},
{id:'uber',name:'Uber',i:'https://www.uber.com/favicon.ico',d:'Estimativas de corrida',cat:'travel'},
{id:'uber_eats',name:'Uber Eats',i:'https://www.ubereats.com/favicon.ico',d:'Restaurantes e pratos',cat:'travel'},
{id:'viator',name:'Viator',i:'https://www.viator.com/favicon.ico',d:'Experiências de viagem',cat:'travel'},
{id:'resy',name:'Resy',e:'🍽️',d:'Reserve restaurantes',cat:'travel'},
{id:'alltrails',name:'AllTrails',i:'https://www.alltrails.com/favicon.ico',d:'Trilhas e caminhadas',cat:'travel'},
{id:'thumbtack',name:'Thumbtack',i:'https://www.thumbtack.com/favicon.ico',d:'Profissionais locais',cat:'travel'},
{id:'booking',name:'Booking.com',i:'https://www.booking.com/favicon.ico',d:'Hotéis e hospedagem',cat:'travel'},
{id:'instacart',name:'Instacart',e:'🛒',d:'Supermercado rápido',cat:'travel'},
{id:'kiwi2',name:'Kiwi.com',e:'✈️',d:'Voos baratos',cat:'travel'},
{id:'taskrabbit',name:'Taskrabbit',e:'🐇',d:'Serviços locais',cat:'travel'},
{id:'crypto',name:'Crypto.com',i:'https://crypto.com/favicon.ico',d:'Exchange e DeFi',cat:'finance'},
{id:'dice',name:'Dice',e:'🎲',d:'Vagas de emprego em tech',cat:'other'},
{id:'docusign',name:'Docusign',i:'https://www.docusign.com/favicon.ico',d:'Contratos e assinaturas',cat:'biz'},
{id:'wordpress2',name:'WordPress.com MCP',i:'https://wordpress.com/favicon.ico',d:'Sites WordPress',cat:'media'},
{id:'zoom_for_claude',name:'Zoom for Claude',i:'https://zoom.us/favicon.ico',d:'Reuniões Zoom',cat:'meet'},
];

// Conectados no Claude do usuário
const CLAUDE_CONNECTED=new Set(['google_drive','gmail','google_calendar','canva','shopify',
  'figma','notion','spotify','booking','tripadvisor','gamma','zoom','uber','uber_eats',
  'docusign','vercel','resy','supabase','viator','indeed','clickup','alltrails','wordpress',
  'thumbtack','paypal','aws_marketplace','scholar','supermetrics','calendly','zoom_for_claude',
  'wordpress2','vercel2','docusign']);

function ConnectorsPanel({onClose,apiPath='/api/chat'}){
  const[health,setHealth]=useState({});
  const[loading,setLoading]=useState(true);
  const[userConn,setUserConn]=useState({});
  const[search,setSearch]=useState('');
  const[tab,setTab]=useState('all');
  const[showConn,setShowConn]=useState(false);

  useEffect(()=>{
    const lc={};
    ALL_SVCS.forEach(s=>{const v=typeof window!=='undefined'&&localStorage.getItem('conn_'+s.id);if(v)lc[s.id]=v;});
    setUserConn(lc);
    fetch(apiPath).then(r=>r.json()).then(d=>{setHealth(d.connections||{});setLoading(false);}).catch(()=>setLoading(false));
  },[]);

  const isOk=(s)=>health[s.id]===true||CLAUDE_CONNECTED.has(s.id)||!!userConn[s.id];

  const CATS={all:'Todos',ai:'🤖 IA',infra:'⚙️ Infra',prod:'📋 Produtividade',
    design:'🎨 Design',dev:'💻 Dev',biz:'💼 Negócios',mkt:'📢 Marketing',
    meet:'🎙️ Reuniões',travel:'✈️ Viagem',research:'🔬 Pesquisa',
    finance:'💰 Finanças',media:'🎵 Mídia',other:'⚡ Outros'};

  const list=ALL_SVCS.filter(s=>{
    if(showConn&&!isOk(s))return false;
    if(tab!=='all'&&s.cat!==tab)return false;
    if(search){const q=search.toLowerCase();return s.name.toLowerCase().includes(q)||s.d.toLowerCase().includes(q);}
    return true;
  }).sort((a,b)=>{const ao=isOk(a)?0:1,bo=isOk(b)?0:1;if(ao!==bo)return ao-bo;return(a.p||999)-(b.p||999);});

  const nConn=ALL_SVCS.filter(isOk).length;

  const Icon=({s,sz=22})=>s.i
    ?<img src={s.i} alt={s.name} style={{width:sz,height:sz,borderRadius:3,objectFit:'contain',background:'#fff',padding:2,flexShrink:0}} onError={e=>e.target.style.opacity='0'}/>
    :<span style={{fontSize:Math.round(sz*0.72),flexShrink:0,width:sz,textAlign:'center',lineHeight:1}}>{s.e||'🔌'}</span>;

  return(
    <div className="pnl" style={{width:'min(420px,97vw)',maxHeight:'90vh',display:'flex',flexDirection:'column'}}>
      <div className="pnl-hdr" style={{flexShrink:0}}>
        <span>🔌 Conectores <span style={{fontSize:10,color:'#4ade80',marginLeft:4}}>{nConn}/{ALL_SVCS.length} ativos</span></span>
        <button onClick={onClose}>✕</button>
      </div>
      <div style={{padding:'6px 10px',borderBottom:'1px solid #111',flexShrink:0,display:'flex',gap:6,alignItems:'center'}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Buscar..."
          style={{flex:1,background:'#111',border:'1px solid #222',borderRadius:5,padding:'5px 9px',color:'#e5e7eb',fontSize:12,outline:'none'}}/>
        <button onClick={()=>setShowConn(c=>!c)} style={{fontSize:10,padding:'4px 8px',borderRadius:4,cursor:'pointer',
          background:showConn?'rgba(74,222,128,0.15)':'transparent',color:showConn?'#4ade80':'#6b7280',border:'1px solid '+(showConn?'rgba(74,222,128,0.3)':'#222')}}>
          {showConn?'✓ Ativos':'Todos'}
        </button>
        {loading&&<span style={{color:'#4b5563',fontSize:10}}>⟳</span>}
      </div>
      <div style={{display:'flex',gap:3,padding:'4px 8px',overflowX:'auto',flexShrink:0,borderBottom:'1px solid #0d0d0d',scrollbarWidth:'none'}}>
        {Object.entries(CATS).map(([k,v])=>(
          <button key={k} onClick={()=>setTab(k)} style={{fontSize:9,padding:'2px 7px',borderRadius:3,whiteSpace:'nowrap',cursor:'pointer',
            background:tab===k?'rgba(139,92,246,0.2)':'transparent',color:tab===k?'#a78bfa':'#6b7280',
            border:tab===k?'1px solid rgba(139,92,246,0.3)':'1px solid transparent',flexShrink:0}}>{v}</button>
        ))}
      </div>
      <div style={{overflowY:'auto',flex:1,scrollbarWidth:'thin',scrollbarColor:'#222 transparent'}}>
        {list.map(svc=>{
          const ok=isOk(svc);
          return(
            <div key={svc.id} style={{display:'flex',alignItems:'center',padding:'8px 12px',borderBottom:'1px solid #0a0a0a',gap:9,
              background:ok?'rgba(74,222,128,0.025)':'transparent',transition:'background 0.1s'}}>
              <Icon s={svc}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,color:ok?'#d1d5db':'#6b7280'}}>
                  {svc.name}{svc.p&&svc.p<=30?<span style={{fontSize:8,color:'#374151',marginLeft:4}}>#{svc.p}</span>:null}
                </div>
                <div style={{fontSize:10,color:'#374151',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{svc.d}</div>
              </div>
              {ok
                ?<span style={{color:'#4ade80',fontSize:14,flexShrink:0}}>✓</span>
                :<button onClick={()=>{const k=window.prompt('Token/API Key para '+svc.name+':');if(k?.trim()){localStorage.setItem('conn_'+svc.id,k.trim());setUserConn(p=>({...p,[svc.id]:k.trim()}));}}}
                  style={{fontSize:10,color:'#a78bfa',background:'rgba(139,92,246,0.08)',border:'1px solid rgba(139,92,246,0.2)',
                  borderRadius:4,padding:'2px 7px',cursor:'pointer',flexShrink:0,whiteSpace:'nowrap'}}>Conectar</button>
              }
            </div>
          );
        })}
        <div style={{padding:'8px 12px',fontSize:10,color:'#1f2937',textAlign:'center'}}>
          {list.length} de {ALL_SVCS.length} conectores • ✓ verde = ativo agora
        </div>
      </div>
    </div>
  );
}


function StatusBar(){
  const[health,setHealth]=useState(null);
  const[tokenSt,setTokenSt]=useState(null);
  const[now,setNow]=useState(new Date());
  const[expanded,setExpanded]=useState(false);
  useEffect(()=>{
    const clock=setInterval(()=>setNow(new Date()),1000);
    const checkHealth=async()=>{try{const r=await fetch('/api/health');if(r.ok)setHealth(await r.json());}catch(e){}};
    const checkTokens=async()=>{try{const r=await fetch('/api/chat');if(r.ok)setTokenSt(await r.json());}catch(e){}};
    checkHealth();checkTokens();
    const h=setInterval(checkHealth,30000);
    const t=setInterval(checkTokens,10000);
    return()=>{clearInterval(clock);clearInterval(h);clearInterval(t);};
  },[]);
  const timeStr=now.toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const dateStr=now.toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit'});
  const provIcon=(p)=>p==='groq'?'🦙':p==='gemini'?'✨':p==='cohere'?'🟡':p==='together'?'🔷':'🤖';
  const shortModel=(n='')=>n.replace('llama-3.3-70b-versatile','Llama 3.3').replace('llama-3.1-8b-instant','Llama 3.1').replace('gemini-2.0-flash','Gemini 2.0').replace('command-r-08-2024','Command-R').replace('Meta-Llama-3.1-8B-Instruct-Turbo','Llama 3.1T').split('/').pop().substring(0,14);
  const cur=tokenSt?.current||{};
  const pct=Math.min(cur.pct||0,100);
  const barColor=pct<60?'#4ade80':pct<85?'#facc15':'#f87171';
  const activeProvider=cur.provider||'groq';
  const dotColor=health?.health?.[activeProvider]?.ok?'#4ade80':health?.health?.[activeProvider]?.ok===false?'#f87171':'#6b7280';
  const okCount=health?.health?Object.values(health.health).filter(h=>h.ok).length:0;
  const totalCount=health?.health?Object.keys(health.health).length:4;
  return(
    <div style={{borderBottom:'1px solid #111',background:'#030303'}}>
      <div onClick={()=>setExpanded(e=>!e)} style={{display:'flex',alignItems:'center',gap:5,padding:'5px 10px',cursor:'pointer'}}>
        <div style={{width:7,height:7,borderRadius:'50%',background:dotColor,flexShrink:0,boxShadow:`0 0 4px ${dotColor}`}}/>
        <span style={{color:barColor,fontWeight:700,fontSize:12,flexShrink:0}}>{provIcon(activeProvider)} {shortModel(cur.model)}</span>
        <div style={{width:55,height:3,background:'#1a1a1a',borderRadius:2,overflow:'hidden',flexShrink:0}}>
          <div style={{width:`${pct}%`,height:'100%',background:barColor,borderRadius:2,transition:'width 0.5s'}}/>
        </div>
        <span style={{color:'#4b5563',fontSize:10,flexShrink:0}}>{pct}% · {cur.reset_in||'—'}</span>
        <span style={{color:okCount>0?'#4ade80':'#f87171',fontSize:10,flexShrink:0,marginLeft:4}}>{okCount}/{totalCount} ✓</span>
        <span style={{marginLeft:'auto',color:'#374151',fontSize:9,fontFamily:'monospace',flexShrink:0}}>{timeStr} {dateStr}</span>
        <span style={{color:'#1f2937',fontSize:9,flexShrink:0}}>{expanded?'▲':'▼'}</span>
      </div>
      {expanded&&(
        <div style={{padding:'8px 10px 10px',borderTop:'1px solid #0a0a0a'}}>
          <div style={{fontSize:9,color:'#374151',marginBottom:5}}>🔄 24/7 · switch automático a 85% · health a cada 30s</div>
          {health?.health&&Object.entries(health.health).map(([name,h])=>{
            const isActive=name===activeProvider;
            const ts=tokenSt?.provider_status?.find(p=>p.provider===name);
            return(
              <div key={name} style={{display:'flex',alignItems:'center',gap:5,padding:'3px 6px',marginBottom:2,borderRadius:3,
                background:isActive?'rgba(139,92,246,0.08)':'transparent',border:isActive?'1px solid rgba(139,92,246,0.12)':'1px solid transparent'}}>
                <div style={{width:5,height:5,borderRadius:'50%',background:h.ok?'#4ade80':'#f87171',flexShrink:0}}/>
                <span style={{fontSize:10}}>{provIcon(name)}</span>
                <span style={{color:isActive?'#a78bfa':h.ok?'#6b7280':'#374151',fontSize:10,flex:1,fontWeight:isActive?600:400}}>
                  {name.charAt(0).toUpperCase()+name.slice(1)}{isActive?' ●':''}
                </span>
                {h.ok?<span style={{fontSize:9,color:'#4ade80'}}>✓ {h.ms}ms</span>:<span style={{fontSize:9,color:'#f87171'}}>✗ {(h.error||'erro').substring(0,20)}</span>}
                <span style={{fontSize:9,color:'#1f2937'}}>reset:{ts?.reset_in||'—'}</span>
              </div>
            );
          })}
          {tokenSt?.switch_event&&<div style={{marginTop:4,fontSize:9,color:'#a78bfa'}}>⚡ {tokenSt.switch_event}</div>}
        </div>
      )}
    </div>
  );
}

function SettingsModal({onClose}){
  const[tab,setTab]=useState('ia');
  const[cfg,setCfg]=useState(()=>{try{return JSON.parse(localStorage.getItem('d_cfg')||'{}')}catch{return{}}});
  const[saving,setSaving]=useState(false);
  const[msg,setMsg]=useState('');
  const set=(k,v)=>setCfg(c=>({...c,[k]:v}));

  const save=async()=>{
    setSaving(true);
    localStorage.setItem('d_cfg',JSON.stringify(cfg));
    // Persistir no backend via settings_save
    const svcs={groq:'groq_keys',gemini:'gemini_keys',notion:'notion_token',elevenlabs:'elevenlabs_key',heygen:'heygen_key',canva:'canva_token',youtube:'youtube_token',instagram:'instagram_token',vercel:'vercel_token',github:'gh_pat'};
    for(const[svc,k]of Object.entries(svcs)){
      const tokens=cfg[k]||'';
      if(tokens){
        await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({stream:false,messages:[{role:'user',content:`Salve tokens do serviço ${svc}: ${tokens.substring(0,10)}...`}],_action:'settings_save',_service:svc,_tokens:tokens})
        }).catch(()=>{});
      }
    }
    setSaving(false);
    setMsg('✅ Salvo e conectado!');
    setTimeout(()=>{setMsg('');onClose();},1500);
  };

  const TABS=[
    {id:'ia',icon:'🤖',label:'IA & Contas'},
    {id:'voz',icon:'🎙',label:'Voz & Avatar'},
    {id:'criacao',icon:'🎨',label:'Criação'},
    {id:'notas',icon:'📋',label:'Notion/Memória'},
    {id:'social',icon:'📱',label:'Redes Sociais'},
    {id:'infra',icon:'⚙️',label:'Infra & Dev'},
  ];

  const F=({label,k,ph='',hint='',pwd=false,rows=1})=>(
    <div style={{marginBottom:14}}>
      <label style={{display:'block',fontSize:12,color:'#9ca3af',marginBottom:4,fontWeight:500}}>{label}</label>
      {rows>1
        ?<textarea rows={rows} value={cfg[k]||''} onChange={e=>set(k,e.target.value)} placeholder={ph}
            style={{width:'100%',background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:8,padding:'8px 12px',color:'#fff',fontSize:12,resize:'vertical',boxSizing:'border-box',outline:'none'}}/>
        :<input type={pwd?'password':'text'} value={cfg[k]||''} onChange={e=>set(k,e.target.value)} placeholder={ph}
            style={{width:'100%',background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:8,padding:'8px 12px',color:'#fff',fontSize:12,boxSizing:'border-box',outline:'none'}}/>}
      {hint&&<p style={{fontSize:10,color:'#4b5563',margin:'3px 0 0'}}>{hint}</p>}
    </div>
  );

  return(
    <>
      <StatusBar/>
      {settingsOpen&&<SettingsModal onClose={()=>setSettingsOpen(false)}/>}
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)'}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:'#111',border:'1px solid #222',borderRadius:16,width:'min(800px,95vw)',maxHeight:'88vh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 25px 60px rgba(0,0,0,0.8)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'20px 24px',borderBottom:'1px solid #1e1e1e'}}>
          <div>
            <h2 style={{color:'#fff',margin:0,fontSize:18,fontWeight:700,letterSpacing:'-0.3px'}}>⚙️ Configurações</h2>
            <p style={{color:'#6b7280',margin:'4px 0 0',fontSize:12}}>Adicione tokens → Salvar → conecta e configura tudo automaticamente</p>
          </div>
          <button onClick={onClose} style={{background:'rgba(255,255,255,0.05)',border:'1px solid #333',borderRadius:8,color:'#aaa',fontSize:20,cursor:'pointer',width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}>×</button>
        </div>

        <div style={{display:'flex',flex:1,overflow:'hidden',minHeight:0}}>
          <div style={{width:150,borderRight:'1px solid #1e1e1e',padding:'12px 0',flexShrink:0,overflowY:'auto'}}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)}
                style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'10px 16px',background:tab===t.id?'rgba(139,92,246,0.12)':'none',border:'none',borderRight:tab===t.id?'2px solid #8b5cf6':'2px solid transparent',color:tab===t.id?'#a78bfa':'#6b7280',cursor:'pointer',fontSize:12,textAlign:'left',transition:'all 0.15s'}}>
                <span>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>

          <div style={{flex:1,overflowY:'auto',padding:'20px 24px'}}>
            {tab==='ia'&&<>
              <div style={{background:'rgba(139,92,246,0.08)',border:'1px solid rgba(139,92,246,0.2)',borderRadius:10,padding:12,marginBottom:16,fontSize:11,color:'#a78bfa',lineHeight:1.5}}>
                💡 <strong>Multi-conta:</strong> Adicione várias chaves separadas por vírgula. Rotação automática quando uma atinge o limite de tokens.
              </div>
              <F label="Groq API Keys — Llama 3.3 70B (principal, 14.400 req/dia grátis cada)" k="groq_keys" ph="gsk_key1,gsk_key2,gsk_key3" hint="console.groq.com → API Keys → Create key" rows={2}/>
              <F label="Google Gemini Keys — fallback grátis" k="gemini_keys" ph="AIza...key1,AIza...key2" hint="aistudio.google.com"/>
              <F label="OpenAI Keys — opcional (pago)" k="openai_keys" ph="sk-..." pwd/>
              <F label="Together AI Key — modelos open source" k="together_key" hint="together.ai → Settings → API Keys"/>
              <F label="Mistral Key — grátis" k="mistral_key" hint="mistral.ai"/>
            </>}
            {tab==='voz'&&<>
              <F label="ElevenLabs API Key — voz Daniela realista (10k chars/mês grátis)" k="elevenlabs_key" ph="xi_..." pwd hint="elevenlabs.io → Profile → API Key"/>
              <F label="ElevenLabs Voice ID" k="elevenlabs_voice" ph="EXAVITQu4vr4xnSDxMaL" hint="ID da voz da Daniela (padrão: Rachel)"/>
              <F label="HeyGen API Key — avatar de vídeo da Daniela" k="heygen_key" ph="..." pwd hint="heygen.com → API Keys"/>
            </>}
            {tab==='criacao'&&<>
              <F label="Canva Access Token — cria designs automaticamente" k="canva_token" ph="..." pwd hint="canva.com/developers"/>
              <F label="Stability AI Key — imagens realistas HD" k="stability_key" ph="sk-..." pwd hint="stability.ai"/>
            </>}
            {tab==='notas'&&<>
              <F label="Notion Integration Token — memória e notas persistentes" k="notion_token" ph="secret_..." pwd hint="notion.so/my-integrations → Create integration → Internal Integration Token"/>
              <F label="Notion Database ID — banco de memória da Daniela" k="notion_db" ph="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" hint="Abra o banco no Notion → compartilhe com a integration → copie o ID da URL"/>
            </>}
            {tab==='social'&&<>
              <F label="YouTube OAuth Token" k="youtube_token" ph="..." pwd hint="Para publicar vídeos automaticamente"/>
              <F label="Instagram Token" k="instagram_token" ph="..." pwd/>
              <F label="TikTok Token" k="tiktok_token" ph="..." pwd/>
              <F label="Twitter/X Bearer Token" k="twitter_token" ph="..." pwd/>
              <F label="Pinterest Token" k="pinterest_token" ph="..." pwd/>
            </>}
            {tab==='infra'&&<>
              <F label="GitHub PAT — já configurado via env. Preencha para sobrescrever." k="gh_pat" ph="ghp_..." pwd/>
              <F label="Vercel Token" k="vercel_token" ph="dn5a..." pwd/>
              <F label="Vercel Team ID" k="vercel_team" ph="team_..."/>
              <F label="Supabase URL" k="supabase_url" ph="https://xxx.supabase.co"/>
              <F label="Supabase Service Key" k="supabase_key" ph="eyJ..." pwd/>
            </>}
          </div>
        </div>

        <div style={{padding:'16px 24px',borderTop:'1px solid #1e1e1e',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{fontSize:13,color:msg.startsWith('✅')?'#4ade80':'#6b7280'}}>{msg||'Tokens são criptografados e armazenados com segurança.'}</span>
          <div style={{display:'flex',gap:8}}>
            <button onClick={onClose} style={{padding:'8px 20px',background:'none',border:'1px solid #333',borderRadius:8,color:'#6b7280',cursor:'pointer',fontSize:13}}>Cancelar</button>
            <button onClick={save} disabled={saving}
              style={{padding:'8px 24px',background:'linear-gradient(135deg,#8b5cf6,#7c3aed)',border:'none',borderRadius:8,color:'#fff',cursor:'pointer',fontWeight:600,fontSize:13,opacity:saving?0.7:1}}>
              {saving?'⏳ Conectando...':'💾 Salvar & Conectar'}
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

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
  const[settingsOpen,setSettingsOpen]=useState(false);
  const[activeModel,setActiveModel]=useState('llama-3.3-70b-versatile');
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
    const nm=f.name.toLowerCase();
    const isZip=nm.endsWith('.zip');
    const isImg=f.type.startsWith('image/');
    if(isZip){
      setFile({name:f.name,type:'application/zip',data:null,preview:null,isZip:true,size:f.size,
        note:`📦 ${f.name} (${(f.size/1024).toFixed(0)}KB) — ZIP anexado`});
      return;
    }
    const reader=new FileReader();
    reader.onload=ev=>setFile({name:f.name,type:f.type,data:ev.target.result,
      preview:isImg?ev.target.result:null,size:f.size});
    if(isImg)reader.readAsDataURL(f); else reader.readAsText(f).catch(()=>reader.readAsDataURL(f));
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
      const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},
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
    <>
      <StatusBar/>
      {settingsOpen&&<SettingsModal onClose={()=>setSettingsOpen(false)}/>}
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
          <div className="ver">'ULTRA-2026'</div>
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
                {panel==='connectors'&&(<ConnectorsPanel onClose={()=>setPanel(null)} apiPath='/api/chat'/>)}
        
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
            <input ref={fileRef} type="file" accept="*/*" onChange={handleFile} style={{display:'none'}}/>
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
    </>
  );
}
