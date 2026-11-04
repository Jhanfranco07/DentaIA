# Fase 3 — reproducción local de los servicios clínicos

Informe principal: [IMPLEMENTACION_SERVICIOS_CLINICOS.md](../IMPLEMENTACION_SERVICIOS_CLINICOS.md).

## Entorno

Se reutiliza el stack oficial de Fase 2, Docker Desktop con contexto `desktop-linux`, CLI 3.0.0 y PostgreSQL 17.11. No se instala software ni se crean otros contenedores para esta fase. La base de pruebas nueva se llama **dentaia_arch_qa_fase3**; la base Fase 2 se conserva.

Verificar primero:

```powershell
docker info
docker ps
docker context show
```

Si el stack está detenido, reiniciarlo desde su carpeta temporal `$env:TEMP/DentaIA-arquitectura-fase2-qa` utilizando el CLI ya instalado y su configuración existente. Nunca ejecutar link, pull, push, reset remoto ni copiar .env del repositorio a ese directorio.

## Ejecutar desde la raíz de DentaIA

```powershell
python docs/arquitectura/servicios_clinicos/pruebas/generar_casos.py
python docs/arquitectura/servicios_clinicos/pruebas/ejecutar.py --reset-qa
python docs/arquitectura/servicios_clinicos/pruebas/catalogo.py
```

`--reset-qa` elimina y reconstruye **únicamente** la base de Fase 3 de nombre constante, dentro del contenedor permitido. Omitirlo en la primera ejecución; si la base ya existe, el script se detiene. No se elimina la base postgres, la base de Fase 2 ni ningún volumen/documento. El script rechaza DOCKER_HOST y cualquier contexto distinto de Docker Desktop local.

El bootstrap copia solo el esquema Auth vacío desde el Postgres local oficial. Reconstruye el baseline MVP vacío con el catálogo verificado y aplica exclusivamente 01–04, luego 08–10. No instala los esquemas de administración o IA, ni el prototipo qa.history de la fase anterior.

La fixture crea siete cuentas sin correos ni contraseñas, sesiones SQL AAL1, dos pacientes, dos clínicas y tres profesionales ficticios. La verificación aprobada es solo preparación sintética; no acredita una verificación profesional real. La política **QA-NO-CLINICO-v1** solo existe en esa base.

Los RPC vienen desactivados por defecto. La fixture sustituye explícitamente la función privada de configuración como operador. Los clientes no tienen EXECUTE ni capacidad para reemplazarla. No se debe copiar esa habilitación de QA a un proyecto compartido.

## Evidencias

- [RESULTADOS.json](pruebas/RESULTADOS.json): resultado del último banco y SHA de los SQL ejecutados.
- [INTENTOS.json](pruebas/INTENTOS.json): fallos reales anteriores, sin ocultarlos.
- [CATALOGO_RPC.json](pruebas/CATALOGO_RPC.json): propietarios, SECURITY DEFINER/INVOKER, search_path, políticas, ACL y rol técnico.
- [Casos versionados](pruebas/casos.json) y [carreras reproducibles](pruebas/concurrencia.py).
- [FUENTES_PREVIAS.json](FUENTES_PREVIAS.json): hashes anteriores para comprobar preservación.

Las operaciones RPC usan claims sintéticos que auth.uid()/auth.jwt() interpretan en PostgreSQL. **No son pruebas HTTP ni JWT firmados.** Los servicios HTTP del stack siguen conectados a postgres; la copia QA es otra base.

Once casos usan la conexión `authenticator` por TCP local para probar los permisos del llamador de PostgREST. Su contraseña técnica se lee en memoria de la configuración del contenedor REST local; no se imprime, versiona ni pasa como argumento visible con su valor. No ejecutar manualmente inspect de todas las variables para publicar logs. Nunca se usan claves de Dental-IA.

Los casos de preparación privilegiada cambian posteriormente a authenticated al llamar los RPC. Las pruebas de integridad y permisos del operador no se presentan como evidencia de RLS de un cliente. Las carreras usan procesos PostgreSQL distintos y registran esperas en pg_stat_activity; no se mezclan con pruebas del frontend.

## Regresión del repositorio

```powershell
node --experimental-strip-types --test --test-reporter=tap "src/features/**/*.test.mjs"
npm run typecheck
npm run build
npm audit --audit-level=low
git diff --check
```

No ejecutar build al mismo tiempo que un servidor Next usa la misma carpeta .next. Los resultados de estos comandos no demuestran conectividad HTTP del nuevo backend ni validación clínica.

## Uso posterior

Revisar firmas/DTO/errores en el informe antes de escribir un adaptador. Usar JWT del usuario y verificar `data.ok`/`data.status`, no asumir éxito por HTTP 200. No dar SELECT directo sobre clinical ni convertir service_role en un actor clínico. La integración de rutas/vistas y las pruebas HTTP con GoTrue son la etapa siguiente y requieren revisión; no están realizadas aquí.
