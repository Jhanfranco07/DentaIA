// Solo configuración local ignorada por Git. No modifica Supabase ni Vercel.
import{existsSync,readFileSync,writeFileSync}from'node:fs';
import{join}from'node:path';import{randomBytes}from'node:crypto';
import{readVault,root,clients,ref,dataset}from'./academic-private.mjs';
const v=readVault(),c=clients(),file=join(root,'.env.development.local');
if(v.ref!==ref||!v.seedCommitted||v.accounts.length!==5)throw new Error('VERIFIED_DATASET_REQUIRED');
if(existsSync(file)&&!readFileSync(file,'utf8').startsWith('# DentaIA academic '+dataset))throw new Error('EXISTING_CONFIGURATION_PRESERVED');
const secret=existsSync(file)?readFileSync(file,'utf8').match(/^DENTAIA_CLINICAL_CURSOR_SECRET=(.+)$/m)?.[1]:randomBytes(32).toString('base64url');
if(!secret)throw new Error('CURSOR_SECRET_REQUIRED');
const env={NEXT_PUBLIC_SUPABASE_URL:c.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:c.key,DENTAIA_CLINICAL_HTTP_ENABLED:'true',DENTAIA_CLINICAL_TARGET:'dentalia_academic',DENTAIA_CLINICAL_ACADEMIC_ENABLED:'true',DENTAIA_CLINICAL_PROJECT_REF:ref,DENTAIA_CLINICAL_SUPABASE_URL:c.url,DENTAIA_CLINICAL_SUPABASE_PUBLISHABLE_KEY:c.key,DENTAIA_CLINICAL_DEMO_USER_IDS:v.accounts.map(x=>x.id).join(','),DENTAIA_CLINICAL_CURSOR_SECRET:secret,DENTAIA_CLINICAL_CURSOR_TTL_SECONDS:'300',DENTAIA_ADMIN_READS_ENABLED:'false',DENTAIA_ROLE_WRITES_ENABLED:'false'};
writeFileSync(file,'# DentaIA academic '+dataset+'; SOLO desarrollo local, no Vercel.\n'+Object.entries(env).map(([k,x])=>k+'='+x).join('\n')+'\n');
console.log(JSON.stringify({archivo:'.env.development.local',soloDesarrollo:true,clavePrivilegiadaIncluida:false,requiereReiniciarNext:true}));
