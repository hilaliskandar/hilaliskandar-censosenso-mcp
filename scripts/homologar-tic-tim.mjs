/**
 * Homologação territorial TIC-TIM: gera 30 relatórios municipais em Markdown
 * exclusivamente por chamadas ao CensoSenso MCP remoto.
 *
 * Uso:
 *   node scripts/homologar-tic-tim.mjs
 *   node scripts/homologar-tic-tim.mjs https://host-alternativo
 *
 * Saída:
 *   docs/homologacao-tic-tim-2026-10-03/*.md
 *   docs/homologacao-tic-tim-2026-10-03/matriz-qa.json
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE=(process.argv[2]??"https://censosenso.poderdapalavra.org").replace(/\/+$/,"");
const ROUTE="/mcp/uso-proprio";
const OUT="docs/homologacao-tic-tim-2026-10-03";
const municipios=[
 ["Caieiras","3509007"],["Campinas","3509502"],["Campo Limpo Paulista","3509601"],
 ["Francisco Morato","3516309"],["Franco da Rocha","3516408"],["Jundiaí","3525904"],
 ["Louveira","3527306"],["Valinhos","3556206"],["Vinhedo","3556701"],["Várzea Paulista","3556503"],
 ["Americana","3501608"],["Artur Nogueira","3503802"],["Cabreúva","3508405"],
 ["Cosmópolis","3512803"],["Engenheiro Coelho","3515152"],["Holambra","3519055"],
 ["Hortolândia","3519071"],["Indaiatuba","3520509"],["Itatiba","3523404"],["Itupeva","3524006"],
 ["Jaguariúna","3524709"],["Jarinu","3525201"],["Monte Mor","3531803"],["Morungaba","3532009"],
 ["Nova Odessa","3533403"],["Paulínia","3536505"],["Pedreira","3537107"],
 ["Santa Bárbara d'Oeste","3545803"],["Santo Antônio de Posse","3548005"],["Sumaré","3552403"]
];

let id=1, sessionId=null;
async function rpc(method,params={},notification=false){
 const body={jsonrpc:"2.0",method,params,...(notification?{}:{id:id++})};
 const res=await fetch(BASE+ROUTE,{method:"POST",headers:{
  "Content-Type":"application/json","Accept":"application/json, text/event-stream",
  ...(sessionId?{"mcp-session-id":sessionId}:{})
 },body:JSON.stringify(body)});
 sessionId??=res.headers.get("mcp-session-id");
 if(notification)return null;
 const text=await res.text();
 if(!res.ok)throw new Error(`${method}: HTTP ${res.status} ${text.slice(0,300)}`);
 const payloads=text.includes("data:")
  ?text.split("\n").filter(x=>x.startsWith("data:")).map(x=>x.slice(5).trim())
  :[text];
 const msg=JSON.parse(payloads.at(-1));
 if(msg.error)throw new Error(`${method}: ${JSON.stringify(msg.error)}`);
 return msg.result;
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const transientError=message=>/(?:HTTP|Código HTTP:)\s*(?:5\d\d)|\b(?:520|522|523|524)\b|timeout|temporar|upstream/i.test(message);

async function call(name,args,{tentativas=3}={}){
 let ultimoErro=null;
 for(let tentativa=1;tentativa<=tentativas;tentativa++){
  try{
   const r=await rpc("tools/call",{name,arguments:args});
   if(r?.isError)throw new Error(`${name}: ${r.content?.[0]?.text??"erro"}`);
   return r.structuredContent??{};
  }catch(error){
   ultimoErro=error;
   const mensagem=String(error);
   if(tentativa>=tentativas||!transientError(mensagem))throw error;
   const espera=tentativa*1500;
   console.warn(`retry ${name} ${tentativa}/${tentativas-1} após erro transitório; aguardando ${espera} ms`);
   await sleep(espera);
  }
 }
 throw ultimoErro;
}
const slug=s=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()
 .replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const num=x=>{const n=Number(x);return Number.isFinite(n)?n:null;};
const fmt=(x,d=2)=>x==null?"n/d":x.toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d});
const money=x=>x==null?"n/d":x.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const pct=(a,b)=>a==null||!b?null:100*a/b;
const value=(rows,key,code)=>num(rows.find(r=>r[key]===code)?.Valor);
const indicador=(p,n)=>p.indicadores?.find(x=>x.nome===n);
const src=(label,o)=>o?.provenance?.source_url?`- **${label}:** ${o.provenance.source_url}`:"";
const rows=o=>o.registros??[];

async function gerar(nome,codigo){
 const [
  panorama,idade,estrutura,alfabetizacao,educacao,trabalho,rendaPc,rendaTrabalho,
  corRaca,deficiencia,agua,esgoto,canalizacao,lixo,vizinhos
 ]=await Promise.all([
  call("ibge_cidades",{municipio:codigo}),
  call("ibge_censo",{ano:"2022",tema:"idade_sexo",nivel_territorial:"6",localidades:codigo,formato:"json"}),
  call("ibge_censo",{ano:"2022",tema:"estrutura_etaria",nivel_territorial:"6",localidades:codigo,formato:"json"}),
  call("ibge_censo",{ano:"2022",tema:"alfabetizacao",nivel_territorial:"6",localidades:codigo,formato:"json"}),
  call("ibge_censo",{ano:"2022",tema:"educacao",nivel_territorial:"6",localidades:codigo,formato:"json"}),
  call("ibge_censo",{ano:"2022",tema:"trabalho",nivel_territorial:"6",localidades:codigo,formato:"json"}),
  call("ibge_censo",{ano:"2022",tema:"rendimento",nivel_territorial:"6",localidades:codigo,formato:"json"}),
  call("ibge_sidra",{tabela:"10289",variaveis:"13536,13537",nivel_territorial:"6",localidades:codigo,periodos:"2022",formato:"json"}),
  call("ibge_censo",{ano:"2022",tema:"cor_raca",nivel_territorial:"6",localidades:codigo,formato:"json"}),
  call("ibge_censo",{ano:"2022",tema:"deficiencia",nivel_territorial:"6",localidades:codigo,formato:"json"}),
  call("ibge_datasaude",{indicador:"saneamento_agua",nivel_territorial:"6",localidade:codigo,periodo:"2022",formato:"json"}),
  call("ibge_datasaude",{indicador:"saneamento_esgoto",nivel_territorial:"6",localidade:codigo,periodo:"2022",formato:"json"}),
  call("ibge_sidra",{tabela:"6804",variaveis:"381",nivel_territorial:"6",localidades:codigo,periodos:"2022",classificacoes:"1817[all]",formato:"json"}),
  call("ibge_sidra",{tabela:"6892",variaveis:"381",nivel_territorial:"6",localidades:codigo,periodos:"2022",classificacoes:"67[all]",formato:"json"}),
  call("ibge_vizinhos",{municipio:codigo})
 ]);

 const quin=new Set(["0 a 4 anos","5 a 9 anos","10 a 14 anos","15 a 19 anos","20 a 24 anos",
  "25 a 29 anos","30 a 34 anos","35 a 39 anos","40 a 44 anos","45 a 49 anos","50 a 54 anos",
  "55 a 59 anos","60 a 64 anos","65 a 69 anos","70 a 74 anos","75 a 79 anos","80 a 84 anos",
  "85 a 89 anos","90 a 94 anos","95 a 99 anos","100 anos ou mais"]);
 const ar=rows(idade).filter(r=>quin.has(r.Idade));
 const age=r=>r.Idade==="100 anos ou mais"?100:Number(r.Idade.split(" ")[0]);
 const total=ar.reduce((s,r)=>s+(num(r.Valor)??0),0);
 const soma=fn=>ar.filter(fn).reduce((s,r)=>s+(num(r.Valor)??0),0);
 const p014=soma(r=>age(r)<=10), p1564=soma(r=>age(r)>=15&&age(r)<=60),
       p60=soma(r=>age(r)>=60), p65=soma(r=>age(r)>=65);

 const er=rows(estrutura), ed=rows(educacao), tr=rows(trabalho), rp=rows(rendaPc),
       rt=rows(rendaTrabalho), cr=rows(corRaca), df=rows(deficiencia),
       aw=rows(agua), es=rows(esgoto), ca=rows(canalizacao), li=rows(lixo);
 const etot=value(ed,"Nível de instrução (Código)","120704");
 const rtot=value(cr,"Cor ou raça (Código)","95251");
 const wtot=value(aw,"Existência de ligação à rede geral de distribuição de água e principal forma de abastecimento de água (Código)","72129");
 const stot=value(es,"Tipo de esgotamento sanitário (Código)","46292");
 const ctot=value(ca,"Existência de canalização de água (Código)","72125");
 const ltot=value(li,"Destino do lixo (Código)","10972"), lcol=value(li,"Destino do lixo (Código)","2520");
 const obrigatorios={
  populacaoCenso:total,
  indiceEnvelhecimento:value(er,"Variável (Código)","10612"),
  idadeMediana:value(er,"Variável (Código)","10613"),
  razaoSexo:value(er,"Variável (Código)","8845"),
  alfabetizacao:value(rows(alfabetizacao),"Variável (Código)","2513"),
  totalEscolaridade:etot,
  nivelOcupacao:value(tr,"Variável (Código)","675"),
  rendaPcMedia:value(rp,"Variável (Código)","13431"),
  rendaPcMediana:value(rp,"Variável (Código)","13534"),
  rendaTrabalhoMedia:value(rt,"Variável (Código)","13536"),
  rendaTrabalhoMediana:value(rt,"Variável (Código)","13537"),
  totalCorRaca:rtot,
  pctDeficiencia:value(df,"Variável (Código)","13403"),
  totalAgua:wtot,
  totalEsgoto:stot,
  totalCanalizacao:ctot,
  totalLixo:ltot,
  lixoColetado:lcol
 };
 const ausentes=Object.entries(obrigatorios).filter(([,v])=>v==null||Number.isNaN(v));
 if(ausentes.length)throw new Error(`indicadores obrigatórios ausentes: ${ausentes.map(([k])=>k).join(", ")}`);

 const viz=(vizinhos.vizinhos??vizinhos.municipios??vizinhos.resultados??[])
   .map(x=>x.nome??x.municipio).filter(Boolean);

 const fontes=[
  src("Panorama municipal",panorama),src("Pirâmide etária — 9514",idade),
  src("Estrutura etária — 9515",estrutura),src("Alfabetização — 9543",alfabetizacao),
  src("Escolaridade — 10061",educacao),src("Ocupação — 10268",trabalho),
  src("Renda domiciliar per capita — 10295",rendaPc),src("Rendimento do trabalho — 10289",rendaTrabalho),
  src("Cor ou raça — 9605",corRaca),src("Deficiência — 10125",deficiencia),
  src("Água — 6803",agua),src("Esgoto — 6805",esgoto),src("Canalização — 6804",canalizacao),
  src("Destino do lixo — 6892",lixo),src("Vizinhança",vizinhos)
 ].filter(Boolean).join("\n");

 const md=`# ${nome} — relatório municipal de homologação CensoSenso MCP

> Gerado automaticamente a partir do CensoSenso MCP. Código IBGE **${codigo}**. Referência principal: Censo 2022.

## Panorama

| Indicador | Valor | Ano |
|---|---:|---:|
| População no Censo | ${total.toLocaleString("pt-BR")} pessoas | 2022 |
| População estimada | ${indicador(panorama,"População estimada")?.valor??"n/d"} | ${indicador(panorama,"População estimada")?.ano??"n/d"} |
| Área territorial | ${indicador(panorama,"Área territorial")?.valor??"n/d"} | ${indicador(panorama,"Área territorial")?.ano??"n/d"} |
| Densidade demográfica | ${indicador(panorama,"Densidade demográfica")?.valor??"n/d"} | ${indicador(panorama,"Densidade demográfica")?.ano??"n/d"} |
| PIB per capita | ${indicador(panorama,"PIB per capita")?.valor??"n/d"} | ${indicador(panorama,"PIB per capita")?.ano??"n/d"} |

## Estrutura demográfica

0–14 anos: **${fmt(pct(p014,total))}%**; 15–64 anos: **${fmt(pct(p1564,total))}%**;
60 anos ou mais: **${fmt(pct(p60,total))}%**; 65 anos ou mais: **${fmt(pct(p65,total))}%**.
Índice de envelhecimento: **${fmt(value(er,"Variável (Código)","10612"))}**;
idade mediana: **${fmt(value(er,"Variável (Código)","10613"),0)} anos**;
razão de sexo: **${fmt(value(er,"Variável (Código)","8845"))} homens por 100 mulheres**.

## Educação

Taxa de alfabetização 15+: **${fmt(value(rows(alfabetizacao),"Variável (Código)","2513"))}%**.
Entre pessoas de 18 anos ou mais: sem instrução/fundamental incompleto
**${fmt(pct(value(ed,"Nível de instrução (Código)","9493"),etot))}%**;
fundamental completo/médio incompleto **${fmt(pct(value(ed,"Nível de instrução (Código)","9494"),etot))}%**;
médio completo/superior incompleto **${fmt(pct(value(ed,"Nível de instrução (Código)","9495"),etot))}%**;
superior completo **${fmt(pct(value(ed,"Nível de instrução (Código)","99713"),etot))}%**.

## Trabalho e renda

Nível de ocupação 10+: **${fmt(value(tr,"Variável (Código)","675"))}%**.
Rendimento domiciliar nominal mensal per capita: média **${money(value(rp,"Variável (Código)","13431"))}**
e mediana **${money(value(rp,"Variável (Código)","13534"))}**.
Rendimento nominal mensal de todos os trabalhos: média **${money(value(rt,"Variável (Código)","13536"))}**
e mediana **${money(value(rt,"Variável (Código)","13537"))}**.

## Cor ou raça e deficiência

Branca **${fmt(pct(value(cr,"Cor ou raça (Código)","2776"),rtot))}%**;
preta **${fmt(pct(value(cr,"Cor ou raça (Código)","2777"),rtot))}%**;
parda **${fmt(pct(value(cr,"Cor ou raça (Código)","2779"),rtot))}%**;
amarela **${fmt(pct(value(cr,"Cor ou raça (Código)","2778"),rtot))}%**;
indígena **${fmt(pct(value(cr,"Cor ou raça (Código)","2780"),rtot),3)}%**.
Pessoas de 2 anos ou mais com deficiência: **${fmt(value(df,"Variável (Código)","13403"))}%**.

## Infraestrutura domiciliar

Ligação à rede geral de água usada como forma principal:
**${fmt(pct(value(aw,"Existência de ligação à rede geral de distribuição de água e principal forma de abastecimento de água (Código)","72144"),wtot))}%**.
Domicílios sem ligação à rede geral:
**${fmt(pct(value(aw,"Existência de ligação à rede geral de distribuição de água e principal forma de abastecimento de água (Código)","72153"),wtot))}%**.
Água canalizada dentro da habitação:
**${fmt(pct(value(ca,"Existência de canalização de água (Código)","72126"),ctot))}%**.
Esgotamento por rede geral/pluvial ou fossa ligada à rede:
**${fmt(pct(value(es,"Tipo de esgotamento sanitário (Código)","46290"),stot))}%**.
Fossa séptica/filtro não ligada à rede:
**${fmt(pct(value(es,"Tipo de esgotamento sanitário (Código)","72112"),stot))}%**.
Fossa rudimentar/buraco:
**${fmt(pct(value(es,"Tipo de esgotamento sanitário (Código)","72113"),stot))}%**.
Coleta de lixo:
**${fmt(pct(lcol,ltot))}%**.

## Contexto territorial

${viz.length?`Municípios contíguos: ${viz.join(", ")}.`:"A consulta de vizinhança foi executada, sem nomes utilizáveis no retorno."}

## QA e limites

${(panorama.avisos??[]).map(x=>`- ${x}`).join("\n")||"- Sem avisos do panorama."}
- Valores monetários são nominais de 2022.
- Nenhuma lacuna é preenchida por fonte externa ao CensoSenso.
- Percentuais derivados usam apenas numerador e denominador explicitamente retornados pelo IBGE.
- Comparações entre municípios devem usar a matriz transversal da mesma execução.

## Procedência

${fontes}
`;
 await writeFile(join(OUT,`${slug(nome)}.md`),md,"utf8");
 return {nome,codigo,ok:true,avisos:panorama.avisos??[],fontes:fontes.split("\n").length};
}

await mkdir(OUT,{recursive:true});
await rpc("initialize",{protocolVersion:"2025-06-18",capabilities:{},clientInfo:{name:"homologacao-tic-tim",version:"1.0.0"}});
await rpc("notifications/initialized",{},true).catch(()=>{});

const qa=[];
for(const [nome,codigo] of municipios){
 process.stdout.write(`${nome}... `);
 try{const r=await gerar(nome,codigo);qa.push(r);console.log("ok");}
 catch(e){qa.push({nome,codigo,ok:false,erro:String(e)});console.log("ERRO");}
}
await writeFile(join(OUT,"matriz-qa.json"),JSON.stringify({
 geradoEm:new Date().toISOString(),endpoint:BASE,municipios:qa
},null,2)+"\n","utf8");

const falhas=qa.filter(x=>!x.ok);
console.log(`\nConcluído: ${qa.length-falhas.length}/${qa.length} municípios.`);
if(falhas.length){console.error(falhas);process.exitCode=1;}
