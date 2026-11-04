# Respaldo portable adicional — Fase 8

Fecha: 03/11/2026, America/Lima. Conversión y pruebas **offline**, sin lecturas/escrituras remotas, migraciones, cuentas nuevas o cambios de producción. No se hicieron commits, push ni merge.

## Formato y contenido

Contenedor JSON `DENTAIA-PORTABLE-v1`, cifrado autenticado **AES-256-GCM**, clave CSPRNG de 32 bytes, nonce aleatorio de 12 bytes y tag de 16 bytes. La cabecera versionada se autentica mediante AAD. El contenido íntegro solo se devuelve tras verificar el tag. No se usa una contraseña débil como clave ni se implementa un algoritmo criptográfico propio: se utiliza node:crypto.

Incluye seis archivos privados: dump completo PostgreSQL, roles auxiliares sin contraseñas, membresías, globales sin contraseñas, resumen del snapshot y binarios/mapa de Storage. Se descifraron las copias DPAPI originales en memoria una vez para convertirlas; **la recuperación de la nueva copia no usa DPAPI ni credenciales de Supabase**.

Respaldo definitivo fuera de Git:

`%LOCALAPPDATA%/DentaIA/respaldos-portables/fase8/2026-11-04T00-32-15-106Z/dentalia-fase8.portable.json`

Clave de recuperación, en carpeta distinta y fuera de Git:

`%LOCALAPPDATA%/DentaIA/custodia-claves/fase8/2af514d5-528d-4dc1-8f6a-a1ae201c5d6a/dentalia-fase8.recovery.key`

La ruta y keyId identifican la custodia; **no son la clave**. No imprimir ni adjuntar el contenido del archivo .key. Ambas carpetas tienen permisos restringidos al usuario actual/SYSTEM; el cifrado del respaldo no está ligado a ese usuario. Quien obtenga respaldo y clave podrá descifrar la información privada.

## Validación ejecutada

Se releen el bundle y la clave desde disco. La imagen oficial Node22 Alpine, fijada por digest en el informe, recibe los datos por stdin y descifra en Linux, sin montajes del perfil Windows, sin red, con filesystem de solo lectura, usuario sin privilegios, capacidades retiradas y límite de procesos/memoria. El plaintext viaja exclusivamente por un pipe privado del proceso de verificación; no aparece en logs ni Git.

Pruebas nuevas aprobadas:

- Descifrado de seis archivos y SHA-256 de cada contenido.
- Clave incorrecta rechazada.
- Ciphertext manipulado rechazado, sin entregar contenido.
- pg_restore del dump recuperado, con exit0, en otro PostgreSQL offline/tmpfs sin puertos.
- Conteos y digest coincidentes en las 11 tablas públicas/Auth/Storage del snapshot original.
- Roles auxiliares y 24 membresías recreados solo en esa copia aislada.
- Recuperación íntegra de un archivo Storage y coincidencia de sus 436300 bytes mediante SHA-256.

[RESPALDO_PORTABLE_VERIFICADO.json](RESPALDO_PORTABLE_VERIFICADO.json) registra el hash del bundle cifrado, la imagen fijada, resultados y límites. No contiene clave, contraseña, filas, rutas de pacientes ni binarios. Los dos intentos iniciales de prueba no completaron el descifrado porque no estaba conectado stdin al contenedor; el driver se corrigió con `docker run -i`. El resultado aprobado corresponde exclusivamente a las rutas definitivas de este documento. No usar las copias preliminares como respaldo aprobado.

Los contenedores de prueba se eliminaron de forma controlada. Se conservaron las copias DPAPI originales, el bundle portable y su clave; no se tocaron servicios remotos ni datos del stack original.

## Recuperación portable

Requisitos: Node22 con node:crypto; no requiere Windows, DPAPI, .env o acceso remoto. Conservar también `descifrar_portable.mjs` y el procedimiento de restauración con el paquete de recuperación.

```powershell
node docs/arquitectura/integracion_fase8/descifrar_portable.mjs --bundle <ruta-al-bundle> --key <ruta-al-archivo-key> --output <directorio-privado-nuevo>
```

Los argumentos son **rutas**, nunca el contenido de la clave. El destino debe ser nuevo; el script restringe permisos y rechaza rutas internas peligrosas. El directorio resultante contiene datos privados sin cifrar y no debe estar dentro del repositorio ni compartirse. En Linux se crean permisos 0700/0600; en Windows se establecen ACL privadas. Esta extracción no aplica SQL ni modifica Supabase.

El ensayo automático utilizó memoria/tmpfs, sin exportar plaintext persistente. Restaurar el dump requiere instancia PostgreSQL compatible y roles/owners adecuados, como en el ensayo original. No ejecutar los globales ciegamente sobre un proyecto gestionado existente. El respaldo no incluye contraseñas de login PostgreSQL; tampoco sustituye configuración externa Auth, claves del proveedor o DNS.

## Custodia y limitaciones

**La portabilidad criptográfica está probada; la copia externa/off-site todavía no.** Trasladar el bundle cifrado a un medio externo/almacenamiento autorizado y la clave a otro medio o gestor seguro, con responsables y acceso definidos. Copiar ambos al mismo medio mantiene un riesgo de exposición conjunta. Conservar las claves fuera de GitHub, chat, correo y documentación compartida. No borrar las copias actuales hasta verificar los hashes y la recuperación desde las ubicaciones definitivas.

Perder la clave impide recuperar el bundle. Perder este PC antes de copiar ambos elementos fuera de él también puede perder esta copia: cambiar DPAPI por AES no crea por sí solo una estrategia de custodia independiente.

Storage: los bytes/mapa están respaldados y verificados, pero **no se ensayó upload de recuperación por API ni restauración S3 alojada completa**. Sigue aplicándose la estrategia de reconciliación bucket/ruta/versión del informe Fase8. Las cuatro migraciones propuestas no modifican Storage.

## Autorizaciones pendientes, en esta misma Fase 8

1. Revisar este resultado y autorizar expresamente los cuatro SQL exactos ya conformes para Dental-IA `vwmdknzjyvmsdqpepykz`. Todavía no aplicados.
2. Aplicar y validar únicamente ese paquete, conservando servicios cerrados y datos previos.
3. Preparar un inventario separado de cuentas sintéticas de pacientes, odontólogos y administrador, roles, clínicas ficticias y dataset; pedir autorización específica antes de crear/asignar/insertar. El administrador de prueba necesitará MFA legítimo y no tendrá permisos clínicos automáticos.
4. Tras dicha aprobación: provisionamiento controlado, pruebas reales de login/permisos, configuración académica explícita para Next.js local y guía de cuentas/funcionalidades por integrante.

No se habilita producción ni Preview, no se fusiona PR19 y no se interpreta la autorización de respaldo como autorización de migraciones o de nuevas cuentas.

Referencia técnica consultada: [Node.js Crypto](https://nodejs.org/docs/latest-v22.x/api/crypto.html), createCipheriv/createDecipheriv, AAD y verificación GCM mediante final().
