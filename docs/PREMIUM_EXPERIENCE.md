# DentaIA Premium Experience

Implementación sobre `main` `bcc3ea40bc5f14e212a25721731cba719f8cf6e8`, posterior a la fusión del PR #13. Rama: `feature/jhan-dentaia-premium-experience`. Nuevos commits de Jhan Franco; se conserva la autoría del historial. No se modifica el esquema, las políticas ni los datos compartidos.

## Alcance y aceptación pendiente

La interfaz, navegación y reporte se implementan para pacientes. **Esta entrega no cumple todavía la aceptación de tres fotografías intraorales reales ni de regiones anatómicas sobre esas fotografías.** La política de red impide revisar las fuentes de Wikimedia; las fuentes permitidas examinadas no acreditaron permisos suficientes. Se retiraron las ilustraciones dentales anteriores. Las tres tarjetas locales dicen explícitamente que la fotografía está pendiente y no muestran anatomía ni marcas clínicas inventadas. [Detalle y pasos de incorporación](FOTOGRAFIAS_DEMO.md).

## Cambios

- Inicio editorial, encabezado responsive, pie profesional, jerarquía tipográfica, foco visible, skeleton y estados de error coherentes.
- Transiciones nativas, entrada escalonada, microinteracciones y respeto de `prefers-reduced-motion`; ningún escáner ni porcentaje clínico ficticio.
- Selección → revisión con ampliación accesible → preparación de contenido educativo → resultado → recomendaciones → reporte → siguiente paso opcional.
- SHA-256 de los bytes completos de cada referencia. Cambiar el nombre conserva la asociación; una imagen desconocida no recibe observaciones.
- Reporte A4 con código, fecha de Lima, imagen sin deformación, observaciones, recomendaciones, próximos pasos, atribución y advertencia educativa. La vista previa exacta y la descarga comparten bytes.
- “Buscar odontólogos” reutiliza el directorio existente, con distrito y especialidad derivados de sus datos. No se inventan direcciones, distancias, horarios ni disponibilidad. Se puede regresar al reporte desde el directorio, perfil y solicitud.
- “Omitir por ahora” completa el recorrido y conserva el reporte durante la sesión. Solo se guarda en `sessionStorage` el ID de la referencia pública, etapa y fecha; nunca archivos personales ni resultados privados.
- La solicitud conserva el profesional elegido tras iniciar sesión mediante un retorno interno limitado y validado. Registro, perfil, historial, cancelación, consentimiento y borrado mantienen sus operaciones reales.

## Reproducción

Node.js 22 LTS, según `.nvmrc`. Usar el checkout existente de la tarea.

```bash
npm ci
npm run typecheck
node --experimental-strip-types --test --test-reporter=tap 'src/features/**/*.test.mjs'
npm run build
npm audit
git diff --check
```

El comando exacto de CI, con procesos aislados y Node.js 22, ejecutó 87 pruebas individuales. También se ejecutó con `--experimental-test-isolation=none` en el entorno de comandos restringido: 87/87. No se omiten archivos ni aserciones; no se modifican los workflows.

Para generar los tres reportes, desde la raíz:

```bash
node --experimental-strip-types scripts/generar-reportes-premium.mjs output/pdf/premium
```

El QA de navegador exporta `ejecutarRecorridoPremium(browser, baseURL, outDir, repo)` desde `scripts/qa-premium.mjs`, para un Chromium/Playwright suministrado por el entorno. `qa-recorrido-demo.mjs` reexporta el mismo arnés por compatibilidad. No añade dependencias de navegador al producto. Las respuestas de cuenta, directorio, solicitudes y almacenamiento se interceptan en un contexto aislado: **las operaciones de QA no escriben en Supabase real**. Esta evidencia no acredita RLS real, persistencia remota ni aislamiento entre dos cuentas reales.

## Evidencia y limitaciones

Verificado el 27 de octubre de 2026 (Lima):

- `npm ci`: aprobado con el lockfile existente. No se añadieron dependencias.
- TypeScript y build de producción: aprobados. [Build](evidencias/premium/build.log), [tipos](evidencias/premium/typecheck.log).
- Comando exacto de CI: **87/87 pruebas**, sin omitidas ni canceladas. [TAP](evidencias/premium/pruebas-unitarias.tap).
- `npm audit`: **0 vulnerabilidades**. [Resultado JSON](evidencias/premium/auditoria.json).
- Chromium real contra producción local: **15/15 escenarios**, sin errores de React ni del proveedor simulado. [Resultados y límites](evidencias/premium/resultado-recorrido.json).
- Tamaños 1440, 768 y 390 px; selección, revisión, preparación, resultado, recomendaciones, reporte, búsqueda opcional, omitir, teclado, foco, ampliación/Escape y movimiento reducido. Se detectó y corrigió un desbordamiento de filtros: el flex móvil creaba una segunda columna. Su corrección también se comprobó a 320 px.
- Inicio de sesión, perfil, solicitud e historial/cancelación, consentimiento, galería, revocación y recuperación de borrado parcial: verificados con respuestas interceptadas. No equivalen a pruebas de backend real.
- Tres descargas PDF reales desde Chromium: bytes iguales a la vista previa exacta. Tres PDF A4 generados además por script, renderizados con Poppler y PyMuPDF y revisados visualmente uno a uno. Cada uno tiene una página, una imagen, advertencia, atribución y enlace; sin deformación, cortes ni superposiciones. Las imágenes son referencias editoriales, no fotografías clínicas.
- La ruta de desarrollo devuelve 404 en producción; los tres JPEG locales devuelven 200.
- `git diff --check`: aprobado.

### Capturas y reportes

| Evidencia | Enlace |
| --- | --- |
| Inicio escritorio / tablet / móvil | [1440](evidencias/premium/inicio-1440.png), [768](evidencias/premium/inicio-768.png), [390](evidencias/premium/inicio-390.png) |
| Selección / resultado móvil | [Selección](evidencias/premium/seleccion-390.png), [resultado](evidencias/premium/resultado-390.png) |
| Preparación educativa | [Captura](evidencias/premium/preparacion-educativa.png) |
| Reporte escritorio / móvil | [1440](evidencias/premium/reporte-1440.png), [390](evidencias/premium/reporte-390.png) |
| Búsqueda opcional / omitir | [Búsqueda](evidencias/premium/busqueda-opcional-1440.png), [omitir](evidencias/premium/omitir-390.png) |
| Solicitud / galería privadas simuladas | [Solicitud](evidencias/premium/solicitud-390.png), [galería](evidencias/premium/galeria-390.png) |
| Cuidado habitual | [PDF](../output/pdf/premium/DentaIA-cuidado-habitual.pdf), [render](../output/pdf/premium/renderizados/cuidado-habitual.png) |
| Atención preventiva | [PDF](../output/pdf/premium/DentaIA-atencion-preventiva.pdf), [render](../output/pdf/premium/renderizados/atencion-preventiva.png) |
| Cuidado de encías | [PDF](../output/pdf/premium/DentaIA-cuidado-encias.pdf), [render](../output/pdf/premium/renderizados/cuidado-encias.png) |

La evidencia incluye 38 capturas del build de producción y no acredita fotografías clínicas ni RLS real. Se corrigieron esperas y selectores del arnés durante el desarrollo; los resultados enlazados corresponden a la ejecución completa final.

No se exige ni solicita ubicación del paciente: el directorio ficticio carece de coordenadas verificadas. La demostración no realiza inferencia, diagnóstico, tratamiento personalizado ni almacenamiento privado de su selección. Una solicitud de demostración no confirma una cita ni contacta profesionales. Las pruebas en tamaños de ventana no sustituyen pruebas en dispositivos físicos ni una auditoría exhaustiva de accesibilidad.

GitHub API devuelve `Forbidden` para `GET /user` y `GET /repos/Jhanfranco07/DentaIA`. No se pudo verificar la cuenta conectada ni sus permisos mediante la API. Git HTTPS y `git push --dry-run` responden correctamente, pero no identifican la cuenta: siguiendo la instrucción adicional del usuario, **no se publica hasta verificar la conexión autorizada de Anelis y sus permisos**. Los commits mantienen como autor a Jhan Franco (correo noreply verificado de `Jhanfranco07`); esto no identifica al usuario autenticado para publicar.

Falta aplicar `api.github.com` en la política de red y volver a ejecutar las consultas anteriores. Después de verificar la cuenta y `permissions.push`, subir la rama y crear el PR hacia `main` con el [texto preparado](PR_PREMIUM_EXPERIENCE.md). No fusionar. No se cambió la conexión ni se solicitaron contraseñas o tokens. Actions y Vercel Preview de esta rama permanecen sin verificar; no hay enlace de PR inventado. La autorización del usuario para utilizar la conexión de Anelis se conserva para continuar después de resolver este bloqueo.

Para completar la aceptación fotográfica, aplicar además `commons.wikimedia.org` y `upload.wikimedia.org`, incorporar las tres fotografías con licencia verificada y repetir las verificaciones afectadas. El dominio del Supabase académico también sigue pendiente en los ajustes del entorno; esta entrega no afirma haber validado autenticación remota ni RLS real.
