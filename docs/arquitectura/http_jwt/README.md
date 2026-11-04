# Reproducir Fase 4 — HTTP y JWT reales locales

Informe: [VALIDACION_HTTP_JWT.md](../VALIDACION_HTTP_JWT.md). Se necesitan Docker Desktop, el stack local de Fase 2 ya iniciado, CLI 3.0.0 existente, Node 22.18 y las dependencias ya instaladas. No se agregó ninguna dependencia ni contenedor.

## Qué hace el banco

1. Verifica Docker desktop-linux, proyecto temporal DentaIA-arquitectura-fase2-qa y API loopback. Rechaza DOCKER_HOST y URLs remotas.
2. Verifica que postgres local esté vacío o tenga el marcador propio de esta prueba. Copia estructura de la base Fase 3 y el baseline público vacío en una transacción; no aplica los borradores protegidos a una base no autorizada ni modifica sus guardas.
3. Conserva las bases Fases 2/3. Solo crea/reutiliza seis cuentas con marcador qa_http_phase=4 y aborta ante cuentas ajenas. Se crean mediante Auth Admin local con confirmación de fixture; no se valida registro por correo.
4. Cambia temporalmente jwt_expiry a 60 en el config.toml del stack **temporal**, reinicia con datos persistidos, realiza logins reales y verifica ES256 por SDK. No edita archivos .env ni genera JWT a mano.
5. Inicia Next dev en 127.0.0.1:3104 con variables exclusivas del proceso, clave publicable y una clave aleatoria de cursor. Los requests ordinarios usan JWT del usuario.
6. Ejecuta escenarios HTTP, fault injection y carreras únicamente sobre registros sintéticos. Elimina el trigger de fallo y detiene solo su propio proceso Next.
7. Restaura el config original y reinicia el stack en finally. Comprueba la conservación de las atenciones de Fases 2/3. No elimina ni cambia usuarios reales.

La preparación toma credenciales **solo del CLI local en memoria**. Nunca ejecute un status/inspect completo para pegar su salida en un informe. El banco no imprime ni guarda claves, contraseñas, access_token o refresh_token.

## Comandos desde la raíz del repositorio

```powershell
docker info
docker ps
node docs/arquitectura/http_jwt/ejecutar.mjs
node docs/arquitectura/http_jwt/registrar_entorno.mjs
node --experimental-strip-types --test --test-reporter=tap "src/features/**/*.test.mjs"
npm run typecheck
npm run build
node docs/arquitectura/http_jwt/produccion_cerrada.mjs
npm audit --audit-level=low
python docs/arquitectura/http_jwt/redactar_informe.py
git diff --check
```

El build se ejecuta después de que el banco detiene Next dev: no compartir .next entre ambos procesos simultáneos. Los puertos 3104 y 3105 deben estar libres. Los procesos se inician ocultos y solo se detienen por su PID registrado.

Para actualizar el catálogo HTTP y sus comprobaciones:

```powershell
python docs/arquitectura/http_jwt/actualizar_contratos.py
python docs/arquitectura/herramientas/validar_arquitectura.py --parser-dir "$env:TEMP/DentaIA-DI151-sql-parser"
python docs/arquitectura/herramientas/actualizar_manifest.py
```

El parser ya estaba disponible desde las fases anteriores; no es necesario para la batería HTTP. No regenerar el catálogo con el generador histórico de Fase 1, que describe el estado 7/18 anterior a estas rutas.

## Resultados y alcance

- [RESULTADOS.json](RESULTADOS.json): 59 comprobaciones Auth/Next/PostgREST y sus códigos reales.
- [PRODUCCION_CERRADA.json](PRODUCCION_CERRADA.json): una comprobación adicional del build local, HTTP 404 aunque el flag sea true.
- [INTENTOS.json](INTENTOS.json): intentos previos, incluido el bloqueo de preparación; no se ocultan.
- [ENTORNO_VALIDADO.json](ENTORNO_VALIDADO.json): restauración, cuentas propias, funciones reutilizadas, permisos y bases anteriores.

Los tres endpoints están cerrados por defecto y en producción. Para inspección local, el harness configura DENTAIA_CLINICAL_HTTP_ENABLED, DENTAIA_CLINICAL_SUPABASE_URL, DENTAIA_CLINICAL_SUPABASE_PUBLISHABLE_KEY, DENTAIA_CLINICAL_CURSOR_SECRET y DENTAIA_CLINICAL_CURSOR_TTL_SECONDS únicamente en el proceso hijo. No copie una clave de Dental-IA ni guarde esos valores en el repositorio/chat.

El cursor de QA expira en dos segundos; el valor de aplicación por defecto es 300. El servidor no admite service_role como configuración de su cliente ordinario. La política clínica del banco sigue siendo QA-NO-CLINICO-v1, sin aprobación para pacientes reales.

Las 24 pruebas unitarias nuevas usan dobles de Auth/RPC y relojes controlados; la batería HTTP usa GoTrue y JWT emitidos/verificados de verdad. No confundir los dos tipos de evidencia. La firma del cursor no sustituye la autorización que se reevalúa en cada RPC.

No hay UI nueva, despliegue, correo real, descarga clínica, IA ni validación clínica. La integración de las vistas y una configuración no local requieren revisión posterior del equipo.
