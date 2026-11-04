# Evidencias de Fase 7

Fecha 03/11/2026. Los JSON de este directorio son resultados nuevos; no sobrescriben evidencias F1–6.

- AUDITORIA_INICIAL.json: estado Git/PR y ocho commits administrativos con archivos originales.
- QA_REMOTO.json: cotización, autorización y rechazo por cupo Free; proyecto NO creado.
- PLAN_MIGRACIONES_QA.json: fuentes y hashes en orden; propuesta no desplegada.
- MIGRACIONES_DESDE_CERO.json y REGRESION_SQL.json: reconstrucción MVP y 78 comprobaciones SQL; no JWT HTTP.
- PREPARACION_HTTP.json, REGRESION_HTTP_F4.json e INTENTOS_REGRESION_F4.json: preparación y 59 pruebas HTTP con firmas Auth reales locales.
- HTTP_MVP.json e INTENTOS_HTTP_MVP.json: 45 escenarios integrales nuevos, sin ocultar intentos.
- STORAGE_LIMITES.json: tres rechazos reales de Storage local.
- MFA_LOCAL_RESTAURACION.json y QA_CERRADO.json: configuración restituida y bancos cerrados.
- PRODUCCION_CERRADA.json: ocho métodos 404 en build productivo local.
- COMPROBACIONES_FINALES.json y ARQUITECTURA_ESTATICA.json: controles locales y evidencia de integridad.

Reproducir en el banco Windows existente, SOLO después de comprobar que es sintético propio:

```powershell
python docs/arquitectura/backend_mvp/preparar.py --recrear-qa-propia --fase7
python docs/arquitectura/backend_mvp/regresion_sql.py --fase7
npm run build
node docs/arquitectura/backend_mvp/verificar_produccion.mjs --fase7
python docs/arquitectura/backend_mvp/preparar_http.py --fase7
node docs/arquitectura/backend_mvp/regresion_http_f4.mjs --fase7
node docs/arquitectura/backend_mvp/mfa_local.mjs --fase7
node docs/arquitectura/backend_mvp/validar_storage_limites.mjs --fase7
node docs/arquitectura/versionado_fase6/cerrar_qa.mjs --fase7
```

Secuencia serial: CLI reinicia servicios para JWT/TOTP temporal; Next dev modifica .next y debe ejecutarse después del ensayo build/production. `preparar.py --recrear-qa-propia` elimina exclusivamente la base local de comentario comprobado, no postgres/F2/F3; sin flag de recreación aborta si existe. El resto conserva el banco HTTP marcado. Ante excepción inspeccionar/restaurar config y verificar salud, no repetir a ciegas. Sin credenciales remotas, sin service_role como paciente, sin URLs configurables hacia producción.

Para pruebas unitarias: `node --experimental-strip-types --test --test-reporter=tap "src/features/**/*.test.mjs"`; `npm run typecheck`, `npm run build`, `npm audit`, `git diff --check`. Los scripts Python requieren el Python ya disponible; pglast existente solo para el validador documental, no dependencia de la aplicación. Los logs temporales no se versionan.
