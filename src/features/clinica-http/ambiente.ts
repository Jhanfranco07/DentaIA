// Configuración sin secretos privilegiados; solo BFF local y credencial publicable.
export const DENTALIA_REF="vwmdknzjyvmsdqpepykz";
export const DATASET_ACADEMICO="fase8-synthetic-v1";
export const DENTALIA_PREVIEW_BRANCH="develop";
export const DENTALIA_INTEGRATION_PREVIEW_BRANCH="integration/pr71-pr74-compat-20261117";
type Env=Record<string,string|undefined>;
export function configurarClinica(env:Env){
 const local=!env.VERCEL&&!env.VERCEL_ENV&&env.NODE_ENV==="development";
 const preview=env.VERCEL==="1"&&env.VERCEL_ENV==="preview"&&[DENTALIA_PREVIEW_BRANCH,DENTALIA_INTEGRATION_PREVIEW_BRANCH].includes(env.VERCEL_GIT_COMMIT_REF??"")&&env.DENTAIA_CLINICAL_PREVIEW_ENABLED==="true";
 const production=env.VERCEL==="1"&&env.VERCEL_ENV==="production"&&env.VERCEL_GIT_COMMIT_REF==="main"&&env.DENTAIA_CLINICAL_PRODUCTION_ENABLED==="true";
 const enabled=(local||preview||production)&&env.DENTAIA_CLINICAL_HTTP_ENABLED==="true";
 const remote=env.DENTAIA_CLINICAL_TARGET==="dentalia_academic";
 const secret=env.DENTAIA_CLINICAL_CURSOR_SECRET??"",ttl=Number(env.DENTAIA_CLINICAL_CURSOR_TTL_SECONDS??"300");
 const users=(env.DENTAIA_CLINICAL_DEMO_USER_IDS??"").split(',').filter(Boolean);
 let origin="",valid=false,productionConfig=false;
 try{
  const url=new URL(env.DENTAIA_CLINICAL_SUPABASE_URL??"");origin=url.origin;
  const publicKey=env.DENTAIA_CLINICAL_SUPABASE_PUBLISHABLE_KEY??"";
  let publishable=publicKey.startsWith('sb_publishable_');
  if(!publishable)try{publishable=JSON.parse(Buffer.from(publicKey.split('.')[1],'base64url').toString('utf8')).role==='anon';}catch{}
  const common=!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname==='/'&&publishable&&/^[A-Za-z0-9_-]{43,86}$/.test(secret)&&Buffer.from(secret,'base64url').length>=32&&Number.isInteger(ttl)&&ttl>=1&&ttl<=900;
  const academicConfig=env.DENTAIA_CLINICAL_ACADEMIC_ENABLED==='true'&&env.DENTAIA_CLINICAL_PROJECT_REF===DENTALIA_REF&&url.origin===`https://${DENTALIA_REF}.supabase.co`&&users.length===5&&new Set(users).size===5&&users.every(x=>/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x));
  // Production usa el proyecto de autenticación de la propia aplicación; nunca
  // una lista fija de cuentas de demostración como sustituto de los permisos RPC/RLS.
  const appOrigin=(()=>{try{return new URL(env.NEXT_PUBLIC_SUPABASE_URL??"").origin;}catch{return "";}})();
  productionConfig=production&&env.DENTAIA_CLINICAL_TARGET==="dentalia_production"&&env.DENTAIA_CLINICAL_PRODUCTION_ENABLED==="true"&&url.protocol==="https:"&&url.origin===appOrigin&&url.hostname.endsWith(".supabase.co")&&publicKey===env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const target=remote?(local&&academicConfig||preview&&academicConfig):productionConfig||((!env.DENTAIA_CLINICAL_TARGET||env.DENTAIA_CLINICAL_TARGET==='local')&&url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname));
  valid=common&&target;
 }catch{}
 return{enabled,valid,remote:remote||productionConfig,preview,production,origin,secret,ttl,users,key:env.DENTAIA_CLINICAL_SUPABASE_PUBLISHABLE_KEY??""};
}
export function origenLocalAutorizado(request:Request){
 try{const url=new URL(request.url),origin=request.headers.get('origin');return url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)&&(!origin||origin===url.origin)&&request.headers.get('sec-fetch-site')!=='cross-site';}catch{return false;}
}
export function origenPreviewAutorizado(request:Request,env:Env){
 try{
  const host=env.VERCEL_URL??'';
  if(!host||host!==host.trim()||host.includes('/')||host.includes('@')||host.includes('?')||host.includes('#'))return false;
  const expected=new URL(`https://${host}`);
  if(expected.protocol!=='https:'||expected.port||expected.pathname!=='/'||expected.search||expected.hash||expected.hostname!==host.toLowerCase())return false;
  const url=new URL(request.url),origin=request.headers.get('origin');
  const integrationAlias = env.VERCEL_ENV==='preview' && env.VERCEL_GIT_COMMIT_REF===DENTALIA_INTEGRATION_PREVIEW_BRANCH
    ? 'https://dent-ai-git-integration-pr71-pr74-aa5dad-jhan-francos-projects.vercel.app' : null;
  const allowed=url.origin===expected.origin||url.origin===integrationAlias;
  return allowed&&(!origin||origin===url.origin)&&request.headers.get('sec-fetch-site')!=='cross-site';
 }catch{return false;}
}
export function cuentaAcademicaPermitida(id:string,metadata:Record<string,unknown>,ids:string[]){
 const marker=metadata.dentaia_development;
 return ids.includes(id)&&typeof marker==='object'&&marker!==null&&'dataset'in marker&&marker.dataset===DATASET_ACADEMICO;
}

/** En Production se aceptan solo el dominio oficial y el hostname de este despliegue Vercel. */
export function origenProductionAutorizado(request:Request,env:Env){
 try{
  if(env.VERCEL!=="1"||env.VERCEL_ENV!=="production"||env.VERCEL_GIT_COMMIT_REF!=="main")return false;
  const url=new URL(request.url),origin=request.headers.get("origin");
  if(url.protocol!=="https:"||request.headers.get("sec-fetch-site")==="cross-site")return false;
  const hosts=new Set(["dent-ai-five.vercel.app"]);
  const vercelHost=env.VERCEL_URL??"";
  if(/^[a-z0-9-]+(?:\\.[a-z0-9-]+)*\\.vercel\\.app$/i.test(vercelHost))hosts.add(vercelHost.toLowerCase());
  return hosts.has(url.hostname.toLowerCase())&&(!origin||origin===url.origin);
 }catch{return false;}
}
