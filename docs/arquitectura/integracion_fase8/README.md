# Evidencias vigentes — entorno académico compartido

Next local hacia Dental-IA remoto validado, solo lote sintético. [Informe vigente](../INTEGRACION_FINAL_SUPABASE_DENTALIA.md) y [guía del equipo](../GUIA_FINAL_EQUIPO_DENTAIA.md). No habilitado en Vercel ni apto para uso clínico.

- CUENTAS_ACADEMICAS_REALES.json: cinco altas Auth sin credenciales.
- LOTE_ACADEMICO_REAL.json: UUID del lote y conservación de originales.
- CUENTAS_RLS_MFA_REALES.json: 12 comprobaciones remotas, dos JWT y MFA.
- HTTP_ACADEMICO_REAL.json: 35 comprobaciones Next/Dental-IA reales.
- SEGURIDAD_ACADEMICA_REAL.json: 19 tablas/RLS, ACL y cierre de cuentas anteriores.
- ACTIVACION_PROPUESTA.json y activacion/: SQL exacto aprobado separadamente.
- ACTIVACION_EJECUTADA.json: SHA/versión remota aplicada.
- ACTIVACION_PRUEBAS_LOCALES.json: siete ensayos SQL aislados, no JWT remoto.
- REVISION_PUBLICACION.json y CIERRE_ACADEMICO.json: revisión y resultados finales.

## Antecedentes históricos

Los informes siguientes conservan sus fechas y alcances anteriores, no el estado vigente.

# Evidencia y preparación de Fase 8

**Estado actual:** [las cuatro migraciones fueron aplicadas y validadas en Dental-IA](RESULTADO_MIGRACIONES_REMOTAS.md), con [registro de resultados reales](EJECUCION_MIGRACIONES_REMOTAS.json). El texto de preparación previa se conserva como antecedente. Las cuentas/datos y activación continúan sin ejecutarse; [inventario pendiente de autorización](INVENTARIO_SINTETICO_PARA_APROBACION.md).

Actualización: [respaldo portable adicional](RESPALDO_PORTABLE.md), con [descifrado Linux y restauración aislada verificados](RESPALDO_PORTABLE_VERIFICADO.json). Los respaldos y la clave permanecen fuera de Git; migraciones y cuentas siguen sin autorización de ejecución.

Fecha 03/11/2026, America/Lima. Preparación local; **cero DDL/DML remoto**. El permiso de respaldo de lectura no equivale a aprobación de migraciones.

- CATALOGO_REMOTO_ANTES.json, ACL_Y_EXTENSIONES_REMOTAS.json y TIPOS_COLUMNAS_REMOTAS.json: estructura real leída, sin filas personales.
- CONTROL_DESTINO.json: referencia, configuración pública observada y estado del punto de control.
- inspeccion_remota.sql y huella_publica.sql: consultas SELECT reproducibles, sin secretos.
- MATRIZ_CAMBIOS.md/JSON: comparación de tablas, columnas, RPC y RLS.
- PAQUETE_PROPUESTO.json y migraciones/: cuatro propuestas exactas con SHA y fuentes; fuera de autodespliegue.
- SIMULACION_MIGRACIONES.json e INTENTOS_SIMULACION.json: copia representativa, fallos previos y ensayo final completo. La observación de tres pasos es preliminar.
- REGRESION_PAQUETE_SQL.json: 78 casos originales reejecutados sobre el paquete incremental local.
- RESPALDO_VERIFICADO.json: restauración privada de PostgreSQL y agregados, sin filas.
- RESPALDO_STORAGE.json: copia cifrada, recuperación de bytes y límites de API.
- DATASET_PROPUESTO.json: lote ficticio de cuatro cuentas, dos clínicas y escenarios; no insertado ni ejecutable remotamente.
- REGRESION_HTTP_F4.json, HTTP_MVP.json, STORAGE_LIMITES.json, PRODUCCION_CERRADA.json y QA_CERRADO.json: regresiones NUEVAS en stack local, no Dental-IA.
- COMPROBACIONES_FINALES.json: resultados, sintaxis, hashes e integridad del trabajo.

Los respaldos cifrados y manifiestos privados están fuera del repositorio en `%LOCALAPPDATA%/DentaIA/respaldos/fase8/`; no copiarlos aquí. No quedan datos privados en contenedores de restauración: se usa tmpfs, sin red/puertos, y se elimina exclusivamente el contenedor propio marcado. Las copias originales del stack y los informes F1–7 se conservan.

Antes de repetir SQL de simulación: verificar nombre y comentario de base. `simular_migraciones.py` aborta si existe; `--recrear-simulacion` elimina exclusivamente esa copia ficticia marcada. `regresion_paquete.py` exige base marcada y restaura configuración cerrada. Ninguno acepta URL remota.

Los ensayos HTTP/MFA y los respaldos que usan el contenedor no se ejecutan simultáneamente: los primeros reinician el stack. Un dump descargado sin pg_restore/comparación exitosos no se informa como recuperable. `backup_privado.mjs --revalidar-ultimo` reutiliza el último dump cifrado con resumen de snapshot; no descarga nuevamente datos.

No ejecutar los archivos propuestos con apply_migration/db push ni copiar fixtures a Dental-IA sin la aprobación concreta de [INTEGRACION_FINAL_SUPABASE_DENTALIA.md](../INTEGRACION_FINAL_SUPABASE_DENTALIA.md). Los scripts de respaldo son de lectura remota, no scripts de publicación o migración.
