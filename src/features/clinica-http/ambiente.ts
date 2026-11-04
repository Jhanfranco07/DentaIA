// Configuración sin secretos privilegiados; solo BFF local y credencial publicable.
export const DENTALIA_REF="vwmdknzjyvmsdqpepykz";
export const DATASET_ACADEMICO="fase8-synthetic-v1";
type Env=Record<string,string|undefined>;
export function configurarClinica(env:Env){
 const enabled=env.NODE_ENV!=="production"&&!env.VERCEL&&!env.VERCEL_ENV&&env.DENTAIA_CLINICAL_HTTP_ENABLED==="true";
 const remote=env.DENTAIA_CLINICAL_TARGET==="dentalia_academic";
 const secret=env.DENTAIA_CLINICAL_CURSOR_SECRET??"",ttl=Number(env.DENTAIA_CLINICAL_CURSOR_TTL_SECONDS??"300");
 const users=(env.DENTAIA_CLINICAL_DEMO_USER_IDS??"").split(',').filter(Boolean);
 let origin="",valid=false;
 try{
  const url=new URL(env.DENTAIA_CLINICAL_SUPABASE_URL??"");origin=url.origin;
  const publicKey=env.DENTAIA_CLINICAL_SUPABASE_PUBLISHABLE_KEY??"";
  let publishable=publicKey.startsWith('sb_publishable_');
  if(!publishable)try{publishable=JSON.parse(Buffer.from(publicKey.split('.')[1],'base64url').toString('utf8')).role==='anon';}catch{}
  const common=!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname==='/'&&publishable&&/^[A-Za-z0-9_-]{43,86}$/.test(secret)&&Buffer.from(secret,'base64url').length>=32&&Number.isInteger(ttl)&&ttl>=1&&ttl<=900;
  const target=remote?env.NODE_ENV==='development'&&env.DENTAIA_CLINICAL_ACADEMIC_ENABLED==='true'&&env.DENTAIA_CLINICAL_PROJECT_REF===DENTALIA_REF&&url.origin===`https://${DENTALIA_REF}.supabase.co`&&users.length===5&&new Set(users).size===5&&users.every(x=>/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x)):(!env.DENTAIA_CLINICAL_TARGET||env.DENTAIA_CLINICAL_TARGET==='local')&&url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  valid=common&&target;
 }catch{}
 return{enabled,valid,remote,origin,secret,ttl,users,key:env.DENTAIA_CLINICAL_SUPABASE_PUBLISHABLE_KEY??""};
}
export function origenLocalAutorizado(request:Request){
 try{const url=new URL(request.url),origin=request.headers.get('origin');return url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)&&(!origin||origin===url.origin)&&request.headers.get('sec-fetch-site')!=='cross-site';}catch{return false;}
}
export function cuentaAcademicaPermitida(id:string,metadata:Record<string,unknown>,ids:string[]){
 const marker=metadata.dentaia_development;
 return ids.includes(id)&&typeof marker==='object'&&marker!==null&&'dataset'in marker&&marker.dataset===DATASET_ACADEMICO;
}
