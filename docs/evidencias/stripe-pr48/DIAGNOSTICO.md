# PR #48: reparación de verificaciones

Base revisada: `ff74ab715d3e971097ad9ab38febd2bb79125790` de `feature/stripe-sandbox`. Árbol local limpio antes de cambiar de rama; se recuperaron todos los commits de Stephan, incluido el merge y las pruebas nuevas. No se reescribe su historial.

## Causas comprobadas

- [DevSecOps del PR fallido](https://github.com/Jhanfranco07/DentaIA/actions/runs/43348107349), job Lockfile `131632258217`: npm ci rechaza el lockfile por ausencia de `@emnapi/runtime@1.11.3` y `@emnapi/core@2.0.0-beta.2`. Se leyeron los logs completos de instalación y del job final y se reprodujo el fallo con npm 10.9.9 en un directorio limpio.
- Validación final no tiene un defecto propio: rechaza correctamente dependencias fallidas y jobs omitidos. No se debilita ni cambia su condición.
- El merge había versionado marcadores de conflicto en cuenta, la plantilla .env.example y PAGOS_STRIPE.md. La página TSX con marcadores impide compilar aunque GitHub indique mergeable.
- El SDK `stripe` era importado por código y pruebas pero no estaba declarado en package.json. Además, Checkout importaba un helper inexistente y la prueba nueva exigía `handleAsyncPaymentSucceeded`, todavía ausente.
- Checkout devolvía solo id, aunque su botón esperaba json.url. Se conserva id y se añade url; una sesión sin URL produce el error 502 existente.
- El upsert por evento no manejaba el UNIQUE adicional de sesión. Se implementa recuperación acotada de colisión y transiciones condicionadas, sin cambiar el esquema.

## Corrección

SDK stripe fijado a 23.1.0 y versión de Vitest fijada a la ya resuelta 5.1.0. Lockfile actualizado con npm 10.9.9 sin cambiar versiones existentes ajenas a lo necesario. Instalación limpia npm ci aprobada. Ocho jobs preservados; se añade npm test al job unitarias para no omitir la suite TypeScript de Stripe. No se altera el gate ni se omiten auditorías.

Se resuelve cuenta conservando modo/registro, perfilSolicitado y MisPagos, sin modificar el componente de cuenta, autorización, roles o paneles. La plantilla de variables queda sin marcadores y conserva la configuración pública de main junto a placeholders Stripe vacíos; no se inspeccionan ni modifican secretos o archivos .env.local. El helper nuevo de servidor reutiliza el cliente público aislado de identidad ya existente. El cliente admin de Stripe queda tipado con Database y sigue server-only.

Los errores del proveedor no se registran con detalles que puedan contener información privada. Se conservan la comprobación de firma, modo test, respuesta 401, errores 400/500 y manejo de eventos no soportados.

## Validación y alcance

- 493 pruebas Node existentes: aprobadas, incluidas integraciones y guards.
- 41 pruebas Vitest: aprobadas; se conservan las seis pruebas originales de idempotencia y se añaden repeticiones concurrentes en fixture, eventos distintos, terminales, propietario/importe/moneda/plan incompatibles, fallos de almacenamiento, firma del webhook y contrato de Checkout.
- TypeScript aprobado. Build local comprobado; resultado final y URL remota en la entrega/PR.
- npm audit: cero vulnerabilidades en la resolución de dependencias.
- 39 pruebas PostgreSQL existentes aprobadas en clúster nativo desechable por socket, sin TCP ni credenciales remotas; no implican una entrega Stripe real.
- YAML comprobado: ocho jobs; needs del gate intactos; Vitest incluido.
- Migración, tipos de payments, RLS e historial remoto no modificados. La compatibilidad se contrasta con la estructura aplicada y sus dos UNIQUE.

Se revisaron los logs completos de los dos jobs fallidos de Actions. La conexión Vercel disponible responde 404 al despliegue inicial `dpl_6hRjTBMox6MTHYwVBVg3nfLWHjt3` y solo expone otro proyecto. Se solicitó acceso al proyecto dent-ai; no se afirma haber leído sus logs completos mientras no estén accesibles. Los errores de compilación anteriores se comprobaron directamente en el código y mediante build local. El resultado del Preview nuevo se verificará contra su SHA mediante GitHub/Vercel, sin confundirlo con acceso a los logs del despliegue anterior.

No se ejecutan escrituras de Supabase, Stripe real, cambios de secretos o configuración Vercel. Sin cambios de módulos de visión ni workflows FastAPI. El PR no se fusiona ni se despliega a Production.
