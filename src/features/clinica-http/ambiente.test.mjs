import test from'node:test';import assert from'node:assert/strict';
import{configurarClinica,origenLocalAutorizado,origenPreviewAutorizado,origenProductionAutorizado,cuentaAcademicaPermitida,DENTALIA_REF,DATASET_ACADEMICO,DENTALIA_PREVIEW_BRANCH,DENTALIA_INTEGRATION_PREVIEW_BRANCH}from'./ambiente.ts';
const ids=[1,2,3,4,5].map(n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'));
const env={NODE_ENV:'development',DENTAIA_CLINICAL_HTTP_ENABLED:'true',DENTAIA_CLINICAL_TARGET:'dentalia_academic',DENTAIA_CLINICAL_ACADEMIC_ENABLED:'true',DENTAIA_CLINICAL_PROJECT_REF:DENTALIA_REF,DENTAIA_CLINICAL_SUPABASE_URL:`https://${DENTALIA_REF}.supabase.co`,DENTAIA_CLINICAL_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',DENTAIA_CLINICAL_CURSOR_SECRET:'a'.repeat(43),DENTAIA_CLINICAL_DEMO_USER_IDS:ids.join(',')};
test('Remoto solo con todos los flags, origen y allowlist exactos',()=>assert.equal(configurarClinica(env).valid,true));
for(const key of ['DENTAIA_CLINICAL_ACADEMIC_ENABLED','DENTAIA_CLINICAL_PROJECT_REF','DENTAIA_CLINICAL_DEMO_USER_IDS'])test('Falta '+key+' falla cerrado',()=>assert.equal(configurarClinica({...env,[key]:''}).valid,false));
for(const bad of ['https://otro.supabase.co','http://'+DENTALIA_REF+'.supabase.co','https://'+DENTALIA_REF+'.supabase.co/path','https://'+DENTALIA_REF+'.supabase.co?x=1'])test('Rechaza destino '+bad,()=>assert.equal(configurarClinica({...env,DENTAIA_CLINICAL_SUPABASE_URL:bad}).valid,false));
for(const mode of [{NODE_ENV:'production'},{VERCEL:'1'},{VERCEL_ENV:'preview'}])test('Bloqueo de despliegue '+JSON.stringify(mode),()=>assert.equal(configurarClinica({...env,...mode}).enabled,false));
const preview={...env,NODE_ENV:'production',VERCEL:'1',VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:DENTALIA_PREVIEW_BRANCH,VERCEL_URL:'dentaia-preview-clinical.vercel.app',DENTAIA_CLINICAL_PREVIEW_ENABLED:'true'};
test('Preview académico habilitado solo con runtime, rama y flags exactos',()=>{const c=configurarClinica(preview);assert.equal(c.enabled,true);assert.equal(c.valid,true);assert.equal(c.preview,true);});
for(const changes of [{DENTAIA_CLINICAL_PREVIEW_ENABLED:''},{VERCEL_ENV:'production'},{VERCEL_GIT_COMMIT_REF:'integration/sprint5-demo'},{VERCEL:undefined}])test('Preview denegado con condición ausente o distinta '+JSON.stringify(changes),()=>assert.equal(configurarClinica({...preview,...changes}).enabled,false));
test('Preview no acepta configuración académica ajena al proyecto',()=>assert.equal(configurarClinica({...preview,DENTAIA_CLINICAL_PROJECT_REF:'otro-proyecto'}).valid,false));
test('Preview clínico acepta solo develop y rechaza la rama experimental y cualquier otra rama',()=>{
 assert.equal(configurarClinica({...preview,VERCEL_GIT_COMMIT_REF:'develop'}).enabled,true);
 for(const branch of ['feature/preview-clinical-backend','main','integration/sprint5-demo',''])
  assert.equal(configurarClinica({...preview,VERCEL_GIT_COMMIT_REF:branch}).enabled,false);
});
test('Clave privilegiada no aceptada',()=>assert.equal(configurarClinica({...env,DENTAIA_CLINICAL_SUPABASE_PUBLISHABLE_KEY:'sb_secret_fixture'}).valid,false));
test('Allowlist con duplicados no aceptada',()=>assert.equal(configurarClinica({...env,DENTAIA_CLINICAL_DEMO_USER_IDS:Array(5).fill(ids[0]).join(',')}).valid,false));
test('Solo cuenta en allowlist y marcador app_metadata',()=>{assert.equal(cuentaAcademicaPermitida(ids[0],{dentaia_development:{dataset:DATASET_ACADEMICO}},ids),true);assert.equal(cuentaAcademicaPermitida(ids[0],{},ids),false);assert.equal(cuentaAcademicaPermitida('ajeno',{dentaia_development:{dataset:DATASET_ACADEMICO}},ids),false);});
test('Host/origin local y sin cross-site',()=>{assert.equal(origenLocalAutorizado(new Request('http://localhost:3000/api/test')),true);assert.equal(origenLocalAutorizado(new Request('https://ejemplo.com/api/test')),false);assert.equal(origenLocalAutorizado(new Request('http://localhost:3000/api/test',{headers:{origin:'https://ajeno.test'}})),false);});
test('Host/origin Preview se limita al URL único de Vercel',()=>{const env={VERCEL_URL:preview.VERCEL_URL};assert.equal(origenPreviewAutorizado(new Request('https://'+preview.VERCEL_URL+'/api/test'),env),true);assert.equal(origenPreviewAutorizado(new Request('https://otro.vercel.app/api/test'),env),false);assert.equal(origenPreviewAutorizado(new Request('https://'+preview.VERCEL_URL+'/api/test',{headers:{origin:'https://ajeno.test'}}),env),false);assert.equal(origenPreviewAutorizado(new Request('https://'+preview.VERCEL_URL+'/api/test',{headers:{'sec-fetch-site':'cross-site'}}),env),false);});
test('Preview rechaza URL de sistema malformada',()=>{for(const host of ['','https://x.vercel.app','x.vercel.app/path','x.vercel.app?next=x'])assert.equal(origenPreviewAutorizado(new Request('https://x.vercel.app/api/test'),{VERCEL_URL:host}),false);});
test('La rama de integración habilita solo el Preview académico configurado',()=>{
 const c=configurarClinica({...preview,VERCEL_GIT_COMMIT_REF:DENTALIA_INTEGRATION_PREVIEW_BRANCH});
 assert.equal(c.preview,true);assert.equal(c.enabled,true);assert.equal(c.valid,true);
 assert.equal(configurarClinica({...preview,VERCEL_GIT_COMMIT_REF:DENTALIA_INTEGRATION_PREVIEW_BRANCH,VERCEL_ENV:'production'}).enabled,false);
 assert.equal(configurarClinica({...preview,VERCEL_GIT_COMMIT_REF:'main'}).enabled,false);
});
test('Alias de Preview #76 aceptado solo en rama integrada y sin orígenes cruzados',()=>{
 const hostname='dent-ai-git-integration-pr71-pr74-aa5dad-jhan-francos-projects.vercel.app';
 const config={VERCEL_URL:preview.VERCEL_URL,VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:DENTALIA_INTEGRATION_PREVIEW_BRANCH};
 assert.equal(origenPreviewAutorizado(new Request('https://'+hostname+'/api/professional/me'),config),true);
 assert.equal(origenPreviewAutorizado(new Request('https://'+hostname+'/api/professional/me',{headers:{origin:'https://otro.vercel.app'}}),config),false);
 assert.equal(origenPreviewAutorizado(new Request('https://'+hostname+'/api/professional/me',{headers:{'sec-fetch-site':'cross-site'}}),config),false);
 assert.equal(origenPreviewAutorizado(new Request('https://'+hostname+'/api/professional/me'),{...config,VERCEL_GIT_COMMIT_REF:'develop'}),false);
 assert.equal(origenPreviewAutorizado(new Request('https://otro.vercel.app/api/professional/me'),config),false);
});

const prod={
  ...env,
  NODE_ENV:"production",
  VERCEL:"1",
  VERCEL_ENV:"production",
  VERCEL_GIT_COMMIT_REF:"main",
  VERCEL_URL:"dent-ai-abc-jhan-francos-projects.vercel.app",
  DENTAIA_CLINICAL_PRODUCTION_ENABLED:"true",
  DENTAIA_CLINICAL_TARGET:"dentalia_production",
  DENTAIA_CLINICAL_SUPABASE_URL:"https://production-qa.supabase.co",
  NEXT_PUBLIC_SUPABASE_URL:"https://production-qa.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_fixture",
  DENTAIA_CLINICAL_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_fixture",
  DENTAIA_CLINICAL_DEMO_USER_IDS:"",
  DENTAIA_CLINICAL_ACADEMIC_ENABLED:"",
};
test("Production requiere activación explícita y usa Auth propio sin allowlist académica",()=>{
 const config=configurarClinica(prod);
 assert.equal(config.enabled,true);
 assert.equal(config.production,true);
 assert.equal(config.valid,true);
 assert.equal(config.remote,true);
 assert.deepEqual(config.users,[]);
});
for(const changes of [
 {DENTAIA_CLINICAL_PRODUCTION_ENABLED:""},
 {DENTAIA_CLINICAL_HTTP_ENABLED:""},
 {VERCEL_GIT_COMMIT_REF:"develop"},
 {VERCEL_ENV:"preview"},
 {VERCEL:undefined},
 {DENTAIA_CLINICAL_TARGET:"dentalia_academic"},
 {DENTAIA_CLINICAL_CURSOR_SECRET:""},
 {NEXT_PUBLIC_SUPABASE_URL:"https://another.supabase.co"},
 {NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_different"},
 {DENTAIA_CLINICAL_SUPABASE_URL:"http://production-qa.supabase.co"}
]){
 test("Production falla cerrado: "+JSON.stringify(changes),()=>{
  const config=configurarClinica({...prod,...changes});
  assert.equal(config.enabled&&config.valid,false);
 });
}
test("Production restringe host, origen y sec-fetch-site",()=>{
 const good=new Request("https://dent-ai-five.vercel.app/api/professional/me");
 assert.equal(origenProductionAutorizado(good,prod),true);
 assert.equal(origenProductionAutorizado(new Request("https://"+prod.VERCEL_URL+"/api/professional/me"),prod),true);
 assert.equal(origenProductionAutorizado(new Request("https://otro.vercel.app/api/professional/me"),prod),false);
 assert.equal(origenProductionAutorizado(new Request("http://dent-ai-five.vercel.app/api/professional/me"),prod),false);
 assert.equal(origenProductionAutorizado(new Request(good.url,{headers:{origin:"https://evil.example"}}),prod),false);
 assert.equal(origenProductionAutorizado(new Request(good.url,{headers:{"sec-fetch-site":"cross-site"}}),prod),false);
 assert.equal(origenProductionAutorizado(good,{...prod,VERCEL_ENV:"preview"}),false);
});
test("Se conserva la prohibición de Production académico tradicional",()=>{
 const config=configurarClinica({...prod,DENTAIA_CLINICAL_TARGET:"dentalia_academic"});
 assert.equal(config.valid,false);
});

// El nuevo Preview solo admite su hostname único y las cuentas sintéticas existentes.
test('DI-213/214: rama exacta habilitada únicamente en Preview académico',()=>{
 const e={...preview,VERCEL_GIT_COMMIT_REF:'integration/di-213-di-214'};
 assert.equal(configurarClinica(e).enabled&&configurarClinica(e).valid,true);
 for(const changes of [{VERCEL_GIT_COMMIT_REF:'integration/di-213-di-214-other'},{VERCEL_ENV:'production'},{DENTAIA_CLINICAL_PREVIEW_ENABLED:''},{DENTAIA_CLINICAL_HTTP_ENABLED:''}])assert.equal(configurarClinica({...e,...changes}).enabled,false);
 for(const changes of [{DENTAIA_CLINICAL_CURSOR_SECRET:''},{DENTAIA_CLINICAL_DEMO_USER_IDS:''},{DENTAIA_CLINICAL_ACADEMIC_ENABLED:''}])assert.equal(configurarClinica({...e,...changes}).valid,false);
 assert.equal(cuentaAcademicaPermitida(ids[0],{dentaia_development:{dataset:DATASET_ACADEMICO}},ids),true);
 assert.equal(cuentaAcademicaPermitida(ids[0],{},ids),false);
 assert.equal(cuentaAcademicaPermitida('ajeno',{dentaia_development:{dataset:DATASET_ACADEMICO}},ids),false);
});
test('DI-213/214: solo hostname exacto de Vercel, no alias anterior ni cross-site',()=>{
 const e={...preview,VERCEL_GIT_COMMIT_REF:'integration/di-213-di-214'};
 const url='https://'+e.VERCEL_URL+'/api/professional/me';
 assert.equal(origenPreviewAutorizado(new Request(url),e),true);
 assert.equal(origenPreviewAutorizado(new Request('https://dent-ai-git-integration-pr71-pr74-aa5dad-jhan-francos-projects.vercel.app/api/professional/me'),e),false);
 assert.equal(origenPreviewAutorizado(new Request('https://otro.vercel.app/api/professional/me'),e),false);
 assert.equal(origenPreviewAutorizado(new Request(url,{headers:{origin:'https://otro.vercel.app'}}),e),false);
 assert.equal(origenPreviewAutorizado(new Request(url,{headers:{'sec-fetch-site':'cross-site'}}),e),false);
});
