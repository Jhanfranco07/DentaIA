# Banco SQL de Fase 2 — exclusivamente local

No utiliza `.env.local`, ni acepta URLs de conexión, ni llama al conector de Supabase remoto. El ejecutor solo permite el contenedor `supabase_db_DentaIA-arquitectura-fase2-qa` y la base `dentaia_arch_qa_fase2`. Los datos, UUID y textos son sintéticos.

## Preparación autorizada

Docker debe responder a `docker info` y `docker ps`. Se autorizó descargar Supabase CLI 3.0.0 y sus imágenes oficiales. Inicializar una carpeta temporal independiente del repositorio, sin `supabase link`, login ni copia de variables reales:

```powershell
New-Item -ItemType Directory -Path "$env:TEMP/DentaIA-arquitectura-fase2-qa" -Force
Set-Location "$env:TEMP/DentaIA-arquitectura-fase2-qa"
npx --yes supabase@3.0.0 init
npx --yes supabase@3.0.0 start --exclude realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
```

El config local generado utiliza PostgreSQL 17. No instalar el CLI en las dependencias de DentaIA. El stack inicia Auth, API y Storage; no publicar ni registrar sus credenciales locales. La primera descarga puede ser extensa.

## Ejecución reproducible

Desde la raíz de DentaIA:

```powershell
python docs/arquitectura/pruebas_sql/generar_casos.py
python docs/arquitectura/pruebas_sql/generar_prototipo.py
python docs/arquitectura/pruebas_sql/ejecutar.py --container supabase_db_DentaIA-arquitectura-fase2-qa
python docs/arquitectura/pruebas_sql/validar_catalogo_completo.py
python docs/arquitectura/pruebas_sql/redactar_informe.py
python docs/arquitectura/herramientas/actualizar_manifest.py
```

Para repetir **desde limpio**, añadir `--reset-qa`. Ese parámetro elimina y reconstruye únicamente la base QA de nombre constante dentro del contenedor permitido; no elimina imágenes, volúmenes de otros proyectos ni el trabajo del equipo.

El ejecutor crea una base vacía aislada dentro del clúster local. Copia por `pg_dump --schema-only` el esquema Auth oficial inicializado por GoTrue local. Los roles del clúster son los de Supabase local. Reconstruye las cinco tablas públicas vacías y sus restricciones/políticas a partir del inventario verificado de la Fase 1. **Esto es bootstrap de QA, no una nueva migración del MVP.** No copia filas de Dental-IA ni recrea sus tablas remotamente.

Los servicios HTTP del stack siguen conectados a su base local `postgres`; la copia QA se valida mediante SQL. Este banco no afirma haber probado JWT firmados ni MFA interactivo en esa copia. El parámetro custom QA se establece por conexión; no exige dar superusuario a `postgres` para usar ALTER DATABASE.

A continuación aplica los siete borradores en orden 01–07 y comprueba que las columnas existentes permanezcan iguales. La migración administrativa se prueba por separado, sin cambiar el archivo histórico. El adaptador de su suite sustituye los INSERT posicionales de tablas Auth mínimas por columnas explícitas y timestamps del esquema oficial; `admin_adaptado_qa.sql` conserva la copia exacta ejecutada.

## Interpretación de resultados

- `RESULTADOS.json`: resultados reales del último intento, incluidos errores y SHA de cada borrador aplicado. Una ejecución fallida no equivale a aprobación.
- Las pruebas de integridad se ejecutan con el dueño QA para aislar restricciones de permisos. **No prueban RLS**.
- Las pruebas RLS cambian a `anon`/`authenticated`; la identidad se establece con GUC sintéticos compatibles con `auth.uid()`/`auth.jwt()`. No hay JWT firmado ni MFA interactivo en esas pruebas.
- El bloqueo inicial por ACL se distingue de la prueba RLS: para esta última se conceden privilegios de SELECT temporalmente dentro de una transacción que termina en ROLLBACK, conservando las políticas default-deny. `service_role` tiene BYPASSRLS y su bloqueo se atribuye solo a ACL.
- Los borradores **no implementan RPC clínicos positivos**. `prototipo_auditado_qa.sql` vive únicamente en el esquema `qa`, no está en las migraciones y no es código de la aplicación. Ensaya la hipótesis transaccional de acceso/auditoría/revocación. Sus resultados se clasifican aparte y no cierran la integración funcional.
- Las carreras usan procesos `psql` distintos y observación de `pg_stat_activity`, no mocks. Demuestran garantías del prototipo local, no la entrega HTTP/stream de una API que aún no existe.
- Las filas AAL2 del banco administrativo son fixtures SQL, **no una autenticación MFA real**. El esquema oficial mejora la prueba de compatibilidad, pero no sustituye sesiones HTTP firmadas.

## Alcance pendiente

Antes de cualquier rollout: implementar y revisar los RPC reales, integrar verificación HTTP de identidad, ensayar dos JWT y expiración, permisos de objetos Storage y entrega después de revocar; completar escenarios administrativos concurrentes y decidir conservación/licencias. No usar este banco con datos clínicos reales.
