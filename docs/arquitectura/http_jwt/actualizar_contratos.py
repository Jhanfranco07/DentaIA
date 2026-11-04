"""Actualizar solo los tres contratos HTTP implementados; no consulta servicios."""
import json
from pathlib import Path
R=Path(__file__).resolve().parent.parent
rows=json.loads((R/'CONTRATOS_API.json').read_text(encoding='utf8'))
changes={
 ('POST','/api/clinical/access-grants'):dict(request='{membershipId,encounterIds,expiresAt,policyVersion,accepted:true}; Idempotency-Key UUID; sin actor/patientId/purpose',response='HTTP 201/200: {ok,id,estado,expiresAt,revokedAt,replayed,requestId}',errors=[400,401,403,404,409,413,415,503],validation='JWT firmado verificado SDK + getUser fresco; RPC deriva paciente, política/finalidad y audita. Cuerpo cerrado <=8192 bytes; roles canónicos; Origin; no-store. Solo QA local; apagado en producción.'),
 ('POST','/api/clinical/access-grants/:id/revoke'):dict(request='{} JSON; id UUID de ruta; Bearer del propietario',response='HTTP 200: {ok,id,revokedAt,requestId}',errors=[400,401,403,404,413,415,503],validation='JWT real; propiedad y revocación idempotente en RPC; sin actor del cuerpo; Origin; no-store; rollback si falla auditoría.'),
 ('GET','/api/clinical/patients/:patientId/history'):dict(request='membershipId opcional para propio; limit 1..50; cursor v1 cifrado y firmado',response='HTTP 200: {ok,apiVersion:clinical.v1,origen,environment,estado,caso,entries,nextCursor,requestId}',errors=[400,401,403,404,503],validation='JWT SDK + getUser; concesión/rol/contexto frescos en RPC; DTO cerrado; cursor AES-256-GCM+HMAC, vinculado a actor/sesión/paciente/profesional/clínica/contexto/filtros; no-store. Sin descarga clínica.'),
}
for row in rows:
 key=(row['method'],row['path'])
 if key in changes:row.update(changes[key],state='codigo_next_qa_local_con_rpc')
(R/'CONTRATOS_API.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
p=R/'CONTRATOS_API.md';text=p.read_text(encoding='utf8')
text=text.replace('**Actualización Fase 3:**','**Nota histórica de Fase 3 (superada para estas tres rutas por Fase 4):**')
text=text.replace('7 métodos con código en rama (incluidas demo/QA) y 18 propuestos, ninguno clínico/IA operativo','10 métodos con código en rama (incluidos tres clínicos de QA) y 15 propuestos; ninguno de IA operativo')
note='**Fase 4:** los tres Route Handlers clínicos ya están implementados y probados por HTTP con JWT de Auth local; consultar [VALIDACION_HTTP_JWT.md](VALIDACION_HTTP_JWT.md). Están apagados en producción y no se afirma despliegue en main/Vercel.\n\n'
if '**Fase 4:**'not in text:text=text.replace('# Contratos API revisados\n\n','# Contratos API revisados\n\n'+note,1)
for row in [r for r in rows if(r['method'],r['path'])in changes]:
 marker='### '+row['method']+' '+row['path']
 start=text.index(marker);end=text.find('\n### ',start+len(marker))
 if end<0:raise RuntimeError('Fin de sección no encontrado')
 body=marker+'\n\n| Aspecto | Contrato implementado |\n|---|---|\n'
 for label,value in [('Estado','Implementado únicamente en QA local'),('Autorizado',row['authorized']),('Solicitud',row['request']),('Respuesta',row['response']),('Errores',', '.join(map(str,row['errors']))),('Persistencia',', '.join(row['tables'])),('Validaciones',row['validation'])]:body+='| '+label+' | '+value.replace('|','/')+' |\n'
 text=text[:start]+body+'\n'+text[end:]
p.write_text(text,encoding='utf8')
print('Actualizados tres contratos: 10 implementados, 15 propuestos')
