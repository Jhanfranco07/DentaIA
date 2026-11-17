# Evidencia de Fase 3

## Resultado local ejecutado

| Verificación | Resultado |
| --- | --- |
| PostgreSQL 17.6 nativo | **39 aprobadas, 0 fallidas**: `sql.json` contiene cada caso |
| Sintaxis SQL | Parseo y ejecución de la migración final en PostgreSQL real, dentro de transacción |
| Restricciones | PK, FK CASCADE, dos UNIQUE, CHECK de estados, NOT NULL, defaults, INTEGER e índice válidos |
| Permisos/RLS | Tres propietarios aislados; sin sub no hay filas; anon sin lectura; clientes sin INSERT/UPDATE/DELETE/TRUNCATE; service_role fixture puede escribir |
| Defensa adicional RLS | Con grants erróneos temporales, INSERT falla y UPDATE/DELETE no afectan filas; la transacción revierte esos grants |
| Idempotencia | Duplicados rechazados; reentrega por evento ignorada; segundo evento de la misma sesión reproduce conflicto del contrato |
| Rollback | Fallo inyectado antes de COMMIT revierte la tabla y sus objetos dependientes; centinela local intacta |
| TypeScript | `npm run typecheck`, exit 0 después del build; incluye `payments-types.ts`, con errores negativos esperados |
| Preservación de tipos | Eliminando únicamente import/nuevo bloque payments, el archivo coincide en bytes con main; `Payment` coincide con PR #48 |
| Pruebas Node | **493 aprobadas, 0 fallidas/omitidas**: todos los `*.test.mjs` de src/features y src/app, incluidas integraciones existentes |
| Build Next.js 15.5.28 | `npm run build`, exit 0; `build.log` |
| ESLint independiente | No disponible: sin script, configuración ni dependencia. El mensaje del build no acredita una ejecución independiente de ESLint |
| Diff | `git diff --check` sin errores |

Node local: 24.19.0. Para instalar herramientas se usaron directorios temporales externos al proyecto; no se cambiaron sus dependencias. Supabase CLI 2.81.3 generó el único archivo de migración; no se conectó a un proyecto ni ejecutó `db push`. PostgreSQL nativo proviene de `@embedded-postgres/linux-x64@17.6.0-beta.15`; solo se usan sus binarios, no hay emulación de RLS.

Primer intento SQL: 38 aprobadas/1 fallida por una expectativa del arnés: `pg_policies.roles` es `name[]` y el driver lo devolvía como texto. Se convirtió a `text[]` en la consulta de inspección, sin cambiar la política ni el esquema, y la batería completa pasó. Primer intento TypeScript: falló por tipos Next generados de rutas antiguas de la copia local. El build regeneró esos artefactos; el chequeo completo posterior pasó sin cambios ajenos. No se cuentan los primeros intentos como aprobados.

## Comandos ejecutados

```bash
# Después del séptimo commit SQL, nunca sobre versiones parciales:
NODE_PATH=/workspace/work/stripe-tools/node_modules node scripts/test-payments-postgres-local.cjs \
  --socket /workspace/work/stripe-socket --output /workspace/work/stripe-evidence/sql.json
mapfile -d '' tests < <(find src/features src/app -name '*.test.mjs' -print0)
node --experimental-strip-types --test --test-reporter=tap "${tests[@]}"
NEXT_TELEMETRY_DISABLED=1 npm run build
npm run typecheck
git diff --check
# Comparación que NO modifica el índice, árbol de trabajo ni las ramas:
git merge-tree --write-tree --name-only HEAD origin/feature/stripe-sandbox
```

`resumen.json` incluye hashes de la migración y del PDF recibido. Los fixtures usan roles y usuarios sintéticos exclusivamente en el clúster local. No se cargaron credenciales Stripe ni service role reales, ni se cambiaron archivos de entorno.

## Coordinación con PR #48

`merge-pr48.txt` registra tres conflictos: add/add de `docs/PAGOS_STRIPE.md`, contenido de `.env.example` y `src/app/cuenta/page.tsx`. Estos dos últimos son divergencias de la rama de Stephan frente al main actual; esta fase no modifica esos archivos. `src/types/payments.ts` es idéntico en bytes y no figura como conflicto. El merge-tree solo calcula objetos Git para inspección; no hace merge ni cambia su PR.

La estructura DB está preparada para revisión, pero eso no significa que la integración completa de Stripe esté aprobada. Además de resolver conflictos, Stephan debe tratar eventos distintos sobre una sesión existente y representar importes según la divisa.

## Límites

No se probó un fallo sobre producción ni se aplicó allí SQL: el ensayo de atomicidad es local y el runner rechaza destinos TCP. La ausencia de cambios remotos se debe al alcance de ejecución, no a una comparación de datos de producción. No se realizaron pruebas reales de Stripe, JWT/Auth, PostgREST ni aceptación del webhook. El fixture no reemplaza la aceptación posterior en un Supabase autorizado.

La ejecución real de DevSecOps sobre el commit final y el enlace del PR se informan en el propio Pull Request; esta documentación no declara CI remoto aprobado antes de observarlo. El push de feature puede omitir Build según la política vigente; se verificará también el evento pull_request, que sí lo exige. No se cambia ese workflow ni los módulos FastAPI/visión para esta tarea.
